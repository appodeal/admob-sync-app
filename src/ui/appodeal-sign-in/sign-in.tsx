import * as Sentry from '@sentry/browser';
import {AppodealAccountState} from 'interfaces/common.interfaces';
import {onMessageFromMain} from 'lib/messages';
import React from 'react';
import ReactDOM from 'react-dom';
import {SignIn} from 'ui/components/sign-in/SignInComponent';
import '../style.scss';


onMessageFromMain<string>('existingAccount', accountJSON => {
    let account: AppodealAccountState = JSON.parse(accountJSON);
    ReactDOM.render(<SignIn account={account}/>, document.getElementById('content'));
});

if (environment.sentry && environment.sentry.dsn) {
    Sentry.init(environment.sentry);
}
