import * as Sentry from '@sentry/electron';
import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {AdmobApiService} from 'core/admob-api/admob.api';
import {AppodealApi} from 'core/appdeal-api/appodeal-api.factory';
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


export enum SyncRunner {
    User = 1,
    SyncScheduler = 2
}

type FinishPromise = Promise<any>;

export class SyncService {
    private activeSyncs = new Map<Sync, FinishPromise>();
    private destroying = false;


    constructor (private store: Store, private appodealApi: AppodealApi, private onlineService: OnlineService) {

    }

    /**
     * check if there running sync for such Adbmob account
     * @param admobAccount
     */
    public canRun (admobAccount: AdMobAccount) {
        return !this.destroying && ![...this.activeSyncs.keys()].some(sync => sync.adMobAccount.id === admobAccount.id);
    }


    public async runSync (appodealAccountId: string, admobAccount: AdMobAccount, runner: SyncRunner) {
        return new Promise(async (resolve, reject) => {
            if (this.onlineService.isOffline()) {
                console.log('[Sync Service] Can not run sync. No Internet Connection');
                return reject(new Error('Can not run sync. No Internet Connection'));
            }

            if (!this.canRun(admobAccount)) {
                // only one sync per account can be run
                console.warn(`[Sync Service] only one sync per account can be run. Admob Account ${admobAccount.id} has running sync in progress.`);
                return reject(new Error(`Admob Account ${admobAccount.id} has running sync in progress.`));
            }

            if (!await this.store.validateAppVersion()) {
                console.log('[Sync Service] Can not run sync. App version is OutDated!');
                return reject(new Error('Can not run sync. App version is OutDated!'));
            }

            if (!admobAccount.isReadyForReports) {
                console.log('[Sync Service] Can not run sync. AdMob account is not ready. Setup is required!');
                return reject(new Error('Can not run sync. AdMob account is not ready. Setup is required!'));
            }

            const admobSession = await AdMobSessions.getSession(admobAccount);

            if (!admobSession || (await SyncHistory.getHistory(admobAccount)).admobAuthorizationRequired) {
                console.warn(`[Sync Service] [${admobAccount.id} ${admobAccount.email}] can not run sync. User has to Sign In in account first.`);
                return reject(new Error(`Can not run sync for ${admobAccount.email}. User has to Sign In in account first.`));
            }

            const id = uuid.v4();
            const logger = await createSyncLogger(admobAccount, id);

            const adMobApi = new AdmobApiService(await createFetcher(admobSession), logger);

            const sync = new Sync(
                adMobApi,
                this.appodealApi.getFor(appodealAccountId),
                admobAccount,
                appodealAccountId,
                logger,
                id,
                runner
            );

            logger.info(`Sync started by ${runner === SyncRunner.User ? 'User' : 'Schedule'}`);

            const waitToFinish = [];
            const subs = [];
            subs.push(
                sync.events.on(SyncEventsTypes.Started).subscribe(() => SyncHistory.saveSyncStats(sync)),
                sync.events.on(SyncEventsTypes.ReportProgress).subscribe(() => SyncHistory.saveSyncStats(sync)),
                sync.events.on(SyncEventsTypes.Stopped).subscribe(() => SyncHistory.saveSyncStats(sync)),
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


            this.activeSyncs.set(
                sync,
                this.processSync(sync, logger, appodealAccountId)
                    .then(() => resolve(), err => reject(err))
                    .then(async () => {
                        syncNotifications.destroy();
                        subs.forEach(sub => sub.unsubscribe());
                        await Promise.all(waitToFinish);
                        this.activeSyncs.delete(sync);
                        await this.store.updateAdMobAccountInfo(admobAccount);
                    })
            );
        });
    }

    private async processSync (sync: Sync, logger: LoggerInstance, appodealAccountId: string) {
        let error;
        try {
            await sync.run();
        } catch (e) {
            sync.stop('uncaught error during sync');
            // uncaught error during sync.
            sync.hasErrors = true;
            logger.error(e);
            this.reportError(sync, e);
            error = e;
        } finally {
            logger.info('stats');
            logger.info(sync.stats.toPlainObject());
            logger.info('Admob AdUnits and Apps');
            logger.info(JSON.stringify(sync.context.getAdmobState()));
            await logger.closeAsync();
        }
        await this.afterSync(sync, appodealAccountId);
        if (error) {
            throw error;
        }
    }

    private async afterSync (sync: Sync, appodealAccountId: string) {
        try {
            if (sync.hasErrors) {
                console.log(`Sync ${sync.id} finished with errors. Report Log to Appodeal.`);
                await this.submitLog(sync.adMobAccount, sync.id, appodealAccountId);
            }
            await rotateSyncLogs(sync.adMobAccount);
        } catch (e) {
            console.error('Failed to Handle Logs after sync');
            this.reportError(sync, e);
            console.error(e);
        }
        try {
            await SyncHistory.saveSyncStats(sync);
        } catch (e) {
            console.error('Failed to save sync history');
            this.reportError(sync, e);
            console.error(e);
        }
    }


    private async submitLog (admobAccount: AdMobAccount, syncId: string, appodealAccountId: string) {
        const rawLog = await getLogContent(admobAccount, syncId);
        return this.appodealApi.getFor(appodealAccountId).submitLog(admobAccount.id, syncId, rawLog);
    }

    public destroy () {
        this.destroying = true;
        return Promise.all(
            [...this.activeSyncs.entries()].map(
                ([sync, finishPromise]: [Sync, Promise<any>]) =>
                    sync.stop('app closing')
                        .then(() => finishPromise)
                        .catch((e) => {
                            console.error(`Failed to stop Sync correcly ${sync.id}`);
                            console.error(e);
                        })
            )).then(() => {});
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
