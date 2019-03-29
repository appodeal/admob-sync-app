import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {Connector} from 'core/connector';
import {Store} from 'core/store';
import {Action, ActionTypes} from 'lib/actions';


export class AccountsConnector extends Connector {

    constructor (private store: Store) {
        super('accounts');
    }

    async onAction ({type, payload}: Action) {
        switch (type) {
        case ActionTypes.appodealSignIn:
            return this.store.appodealSignIn(payload.email, payload.password);
        case ActionTypes.appodealReSignIn:
            return this.store.reSignInAdmob(payload);
        case ActionTypes.appodealSignOut:
            return this.store.appodealSignOut();
        case ActionTypes.adMobAddAccount:
            return this.store.addAdMobAccount();
        case ActionTypes.selectAccount:
            return this.store.selectAccount(payload);
        case ActionTypes.adMobSetCredentials:
            return this.store.setAdMobCredentials(payload);
        case ActionTypes.adMobSetupTutorial:
            return AdMobSessions.openSetupTutorial();
        case ActionTypes.openAdmobPage:
            return AdMobSessions.openAdmob(payload);
        default:
            return;
        }
    }
}
