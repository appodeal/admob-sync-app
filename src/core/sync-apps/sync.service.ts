import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {AdmobApiService} from 'core/admob-api/admob.api';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {Store} from 'core/store';
import {Sync} from 'core/sync-apps/sync';
import {SyncHistory} from 'core/sync-apps/sync-history';
import {SyncEventsTypes} from 'core/sync-apps/sync.events';
import {createFetcher} from 'lib/fetch';
import {createSyncLogger, getLogContent, LoggerInstance, rotateSyncLogs} from 'lib/sync-logs/logger';

import uuid from 'uuid';
import getSession = AdMobSessions.getSession;


type FinishPromise = Promise<any>;

export class SyncService {
    private activeSyncs = new Map<Sync, FinishPromise>();


    constructor (private store: Store, private appodealApi: AppodealApiService) {

    }

    /**
     * check if there running sync for such Adbmob account
     * @param admobAccount
     */
    public canRun (admobAccount: AdMobAccount) {
        return ![...this.activeSyncs.keys()].some(sync => sync.adMobAccount.id === admobAccount.id);
    }


    public async runSync (admobAccount: AdMobAccount) {

        if (!this.canRun(admobAccount)) {
            // only one sync per account can be run
            console.warn(`only one sync per account can be run. Admob Account ${admobAccount.id} has running sync in progress.`);
            return;
        }

        const admobSession = await getSession(admobAccount);

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
                .subscribe(event => this.store.updateSyncProgress(admobAccount, event))
        );

        this.activeSyncs.set(sync, this.processSync(sync, logger).then(async () => {
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
            console.error(e);
        }
        try {
            await SyncHistory.logSyncEnd(sync);
        } catch (e) {
            console.error('Failed to save sync history');
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
}
