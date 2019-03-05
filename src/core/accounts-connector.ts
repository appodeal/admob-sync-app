import {Store} from 'core/store';
import {Action, ActionTypes} from 'lib/actions';
import {onActionFromRenderer} from 'lib/common';


export class AccountsConnector {

    constructor (private store: Store) {
        this.onAction = this.onAction.bind(this);
        onActionFromRenderer('accounts', action => this.onAction(action));
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
            return this.store.adMobRemoveAccount(payload.accountId);
        }
    }
}
