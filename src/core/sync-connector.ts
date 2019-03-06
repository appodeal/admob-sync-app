import {AdmobApiService} from 'core/admob/api/admob.api';
import {AdmobSignInService} from 'core/admob/sign-in/admob-sign-in';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {Store} from 'core/store';
import {Sync} from 'core/sync-apps/sync';
import {AdmobAccount} from 'interfaces/appodeal.interfaces';
import {Action, ActionTypes} from 'lib/actions';
import {onActionFromRenderer} from 'lib/common';
import {createFetcher} from 'lib/fetch';
import getSession = AdmobSignInService.getSession;


export class SyncConnector {

    private sync: Sync;
    private syncRunner: Promise<any>;


    constructor (private store: Store, private appodealApi: AppodealApiService) {
        this.init();
    }

    init () {
        this.onAction = this.onAction.bind(this);
        onActionFromRenderer('accounts', action => this.onAction(action));
    }

    onAction ({type, payload}: Action) {
        switch (type) {
        case ActionTypes.runSync:
            this.syncRunner = this.runSync(payload);
            // to RunSync
            return;
        }
    }

    async runSync (admobAccount: AdmobAccount) {

        const adMobApi = new AdmobApiService(await createFetcher(await getSession(admobAccount)), console);
        adMobApi.setXrfToken(admobAccount.xsrfToken);
        this.sync = new Sync(
            adMobApi,
            this.appodealApi,
            admobAccount,
            this.store.state.appodealAccount,
            console
        );
        this.sync.run();
    }


    async destory () {
        if (this.sync) {
            this.sync.stop('app closing');
            delete this.sync;
            delete this.syncRunner;
        } else if (this.syncRunner) {
            // await sync then stop

        }
    }
}
