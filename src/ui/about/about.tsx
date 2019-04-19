import * as Sentry from '@sentry/browser';
import React from 'react';
import ReactDOM from 'react-dom';
import '../style.scss';
import {sendToMain} from "lib/messages";
import {action, ActionTypes} from "lib/actions";
import {About} from 'ui/components/about/About';

sendToMain('about', action(ActionTypes.packageInfo)).then(packageInfo => {
    ReactDOM.render(<About packageInfo={packageInfo}/>, document.getElementById('content'));
});

if (environment.sentry && environment.sentry.dsn) {
    Sentry.init(environment.sentry);
}
