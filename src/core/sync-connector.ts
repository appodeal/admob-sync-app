import {AdmobApiService} from 'core/admob/api/admob.api';
import {AdmobSignInService} from 'core/admob/sign-in/admob-sign-in';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {Store} from 'core/store';
import {Sync} from 'core/sync-apps/sync';
import {Action, ActionTypes} from 'lib/actions';
import {onActionFromRenderer} from 'lib/common';
import {createFetcher} from 'lib/fetch';
import {createSyncLogger, getLogContent, rotateSyncLogs} from 'lib/sync-logs/logger';
import uuid from 'uuid';
import getSession = AdmobSignInService.getSession;


export class SyncConnector {

    private sync: Sync;
    private syncRunner: Promise<any>;


    constructor (private store: Store, private appodealApi: AppodealApiService) {
        this.init();
    }

    init () {
        this.onAction = this.onAction.bind(this);
        onActionFromRenderer('sync', action => this.onAction(action));
    }

    onAction ({type, payload}: Action) {
        switch (type) {
        case ActionTypes.runSync:
            this.syncRunner = this.runSync(payload);
            // to RunSync
            return;
        }
    }

    async runSync (admobAccount: AdMobAccount) {

        const id = uuid.v4();
        const logger = await createSyncLogger(admobAccount, id);

        const adMobApi = new AdmobApiService(await createFetcher(await getSession(admobAccount)), logger);

        this.sync = new Sync(
            adMobApi,
            this.appodealApi,
            admobAccount,
            this.store.state.appodealAccount,
            logger,
            id
        );

        try {
            await this.sync.run();
        } catch (e) {
            logger.error(e);
        } finally {
            logger.close();
            if (this.sync.hasErrors) {
                console.log(`Sync ${id} finished with errors. Report Log to Appodeal.`);
                await this.submitLog(admobAccount, id);
            }
        }

        return rotateSyncLogs(admobAccount);
    }

    async submitLog (admobAccount: AdMobAccount, syncId: string) {
        const rawLog = await getLogContent(admobAccount, syncId);
        return this.appodealApi.submitLog(admobAccount.id, syncId, rawLog);
    }


    async destroy () {
        if (this.sync) {
            this.sync.stop('app closing');
            delete this.sync;
            delete this.syncRunner;
        } else if (this.syncRunner) {
            // await sync then stop

        }
    }
}
