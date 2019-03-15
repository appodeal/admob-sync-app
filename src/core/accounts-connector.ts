import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {Connector} from 'core/connector';
import {Store} from 'core/store';
import {Action, ActionTypes} from 'lib/actions';


export class AccountsConnector extends Connector {

    constructor (private store: Store) {
        super('accounts');
        this.init();
    }

    async onAction ({type, payload}: Action) {
        switch (type) {
        case ActionTypes.appodealSignIn:
            return this.store.appodealSignIn(payload.email, payload.password);
        case ActionTypes.appodealSignOut:
            return this.store.appodealSignOut();
        case ActionTypes.adMobAddAccount:
            return this.store.adMobSignIn();
        case ActionTypes.adMobRemoveAccount:
            return this.store.adMobRemoveAccount(payload.account);
        case ActionTypes.selectAdmobAccount:
            return this.store.loadSelectedAdMobAccountLogs(payload);
        case ActionTypes.adMobSetCredentials:
            return  this.store.setAdMobCredentials(payload);
        case ActionTypes.adMobSetupTutorial:
            return AdMobSessions.openSetupTutorial();
        case ActionTypes.openAdmobPage:
            return AdMobSessions.openAdmobWindow(payload);
        }
    }
}
