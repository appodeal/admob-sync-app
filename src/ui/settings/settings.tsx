import * as Sentry from '@sentry/browser';
import {remote} from 'electron';
import {action, ActionTypes} from 'lib/actions';
import {onMessageFromMain, sendToMain} from 'lib/messages';
import React from 'react';
import ReactDOM from 'react-dom';
import {RootComponent} from '../components/root/RootComponent';
import {WindowsControlsComponent} from '../components/windows-controls/WindowsControlsComponent';
import '../style.scss';
import './settings.scss';


onMessageFromMain<string>('store', storeJSON => {
    let store = JSON.parse(storeJSON);
    ReactDOM.render(<RootComponent store={store}/>, document.getElementById('content'));
});
sendToMain('store', action(ActionTypes.getStore));

ReactDOM.render(<WindowsControlsComponent currentWindow={remote.getCurrentWindow()}/>, document.getElementById('controls'));

if (environment.sentry && environment.sentry.dsn) {
    Sentry.init(environment.sentry);
}
