import {Store} from 'core/store';
import {Action, ActionTypes} from 'lib/actions';
import {onActionFromRenderer} from 'lib/common';
import {openSettingsWindow} from 'lib/settings';


export class AccountsConnector {

    constructor (private store: Store) {
        this.onAction = this.onAction.bind(this);
        onActionFromRenderer('accounts', action => this.onAction(action));
    }

    onAction ({type, payload}: Action) {
        switch (type) {
        case ActionTypes.appodealSignIn:
            return this.store.appodealSignIn(payload.email, payload.password);
        case ActionTypes.appodealSignOut:
            return this.store.appodealSignOut();
        case ActionTypes.adMobAddAccount:
            let account = this.store.adMobSignIn();
            openSettingsWindow();
            return account;
        }
    }

    destory () {}
}
