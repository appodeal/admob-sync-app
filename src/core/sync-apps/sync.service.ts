import * as Sentry from '@sentry/electron';
import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {AdmobApiService} from 'core/admob-api/admob.api';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {OnlineService} from 'core/appdeal-api/online.service';
import {Store} from 'core/store';
import {Sync} from 'core/sync-apps/sync';
import {SyncHistory} from 'core/sync-apps/sync-history';
import {SyncNotifications} from 'core/sync-apps/sync-notifications';
import {SyncErrorEvent, SyncEventsTypes} from 'core/sync-apps/sync.events';
import {createFetcher} from 'lib/fetch';
import {createSyncLogger, getLogContent, LoggerInstance, rotateSyncLogs} from 'lib/sync-logs/logger';
import uuid from 'uuid';


type FinishPromise = Promise<any>;

export class SyncService {
    private activeSyncs = new Map<Sync, FinishPromise>();


    constructor (private store: Store, private appodealApi: AppodealApiService, private onlineService: OnlineService) {

    }

    /**
     * check if there running sync for such Adbmob account
     * @param admobAccount
     */
    public canRun (admobAccount: AdMobAccount) {
        return ![...this.activeSyncs.keys()].some(sync => sync.adMobAccount.id === admobAccount.id);
    }


    public async runSync (admobAccount: AdMobAccount) {

        if (this.onlineService.isOffline()) {
            console.log('[Sync Service] Can not run sync. No Internet Connection');
            return;
        }

        if (!this.canRun(admobAccount)) {
            // only one sync per account can be run
            console.warn(`[Sync Service] only one sync per account can be run. Admob Account ${admobAccount.id} has running sync in progress.`);
            return;
        }

        if (!await this.store.validateAppVersion()) {
            console.log('[Sync Service] Can not run sync. App version is OutDated!');
            return;
        }

        const admobSession = await AdMobSessions.getSession(admobAccount);

        if (!admobSession) {
            await SyncHistory.setAuthorizationRequired(admobAccount);
            console.warn(`[Sync Service] [${admobAccount.id} ${admobAccount.email}] can not run sync. User has to Sign In in account first.`);
            return;
        }

        const id = uuid.v4();
        const logger = await createSyncLogger(admobAccount, id);

        const adMobApi = new AdmobApiService(await createFetcher(admobSession), logger);

        const sync = new Sync(
            adMobApi,
            this.appodealApi,
            admobAccount,
            this.store.state.appodealAccount,
            logger,
            id
        );

        const waitToFinish = [];
        const subs = [];
        subs.push(
            sync.events.on(SyncEventsTypes.UserActionsRequired)
                .subscribe(() => { waitToFinish.push(SyncHistory.setAuthorizationRequired(admobAccount, true));}),
            sync.events.on(SyncEventsTypes.CalculatingProgress)
                .subscribe(() => { waitToFinish.push(SyncHistory.setAuthorizationRequired(admobAccount, false));}),
            sync.events.on()
                .subscribe(event => this.store.updateSyncProgress(admobAccount, event)),
            sync.events.on(SyncEventsTypes.Error)
                .subscribe((event: SyncErrorEvent) => {
                    this.reportError(sync, event.error);
                })
        );

        const syncNotifications = new SyncNotifications(sync, this.store);


        this.activeSyncs.set(sync, this.processSync(sync, logger).then(async () => {
            syncNotifications.destroy();
            subs.forEach(sub => sub.unsubscribe());
            await Promise.all(waitToFinish);
            this.activeSyncs.delete(sync);
            await this.store.updateAdMobAccountInfo(admobAccount);
        }));
    }

    private async processSync (sync: Sync, logger: LoggerInstance) {
        try {
            await sync.run();
        } catch (e) {
            // uncaught error during sync.
            sync.hasErrors = true;
            logger.error(e);
            this.reportError(sync, e);
        } finally {
            if (sync.hasErrors) {
                logger.info('Admob AdUnits and Apps');
                logger.info(JSON.stringify(sync.context.adMob));
            }
            await logger.closeAsync();
        }
        await this.afterSync(sync);
    }

    private async afterSync (sync: Sync) {
        try {
            if (sync.hasErrors) {
                console.log(`Sync ${sync.id} finished with errors. Report Log to Appodeal.`);
                await this.submitLog(sync.adMobAccount, sync.id);
            }
            await rotateSyncLogs(sync.adMobAccount);
        } catch (e) {
            console.error('Failed to Handle Logs after sync');
            this.reportError(sync, e);
            console.error(e);
        }
        try {
            await SyncHistory.logSyncEnd(sync);
        } catch (e) {
            console.error('Failed to save sync history');
            this.reportError(sync, e);
            console.error(e);
        }
    }


    private async submitLog (admobAccount: AdMobAccount, syncId: string) {
        const rawLog = await getLogContent(admobAccount, syncId);
        return this.appodealApi.submitLog(admobAccount.id, syncId, rawLog);
    }

    public async destroy () {
        return Promise.all(
            [...this.activeSyncs.entries()].map(
                ([sync, finishPromise]: [Sync, Promise<any>]) =>
                    sync.stop('app closing')
                        .then(() => finishPromise)
                        .catch((e) => {
                            console.error(`Failed to stop Sync correcly ${sync.id}`);
                            console.error(e);
                        })
            ));
    }

    reportError (sync: Sync, error) {
        Sentry.withScope(scope => {
            scope.setTag('sync', sync.id);
            scope.setExtra('syncId', sync.id);
            scope.setExtra('admobAccount', sync.adMobAccount);
            Sentry.captureException(error);
        });
    }
}
