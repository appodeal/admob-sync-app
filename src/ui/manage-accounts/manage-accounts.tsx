import * as Sentry from '@sentry/browser';
import {AppState} from 'core/store';
import {action, ActionTypes} from 'lib/actions';
import {onMessageFromMain, sendToMain} from 'lib/messages';
import React from 'react';
import ReactDOM from 'react-dom';
import {AppodealAccounts} from 'ui/components/appodeal-accounts/AppodealAccountsComponent';
import '../style.scss';
import './manage-accounts.scss';


onMessageFromMain<string>('store', storeJSON => {
    let store: AppState = JSON.parse(storeJSON);
    ReactDOM.render(<AppodealAccounts accounts={store.preferences.accounts.appodealAccounts}/>, document.getElementById('content'));
});
sendToMain('store', action(ActionTypes.getStore));


if (environment.sentry && environment.sentry.dsn) {
    Sentry.init(environment.sentry);
}
