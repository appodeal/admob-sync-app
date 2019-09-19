import React from 'react';
import ReactDOM from 'react-dom';
import {Actions} from '../common/actions';
import {InitSentry} from '../common/initSentry';
import {Popup} from './components/Popup';
import './style.scss';


InitSentry('popup', true);

function render (state) {
    ReactDOM.render(<Popup state={state}/>, document.getElementById('content'));
}

chrome.runtime.sendMessage({type: Actions.getExtensionState}, render);
chrome.runtime.onMessage.addListener(function (msg) {
    console.log('onMessage', msg);
    if (msg.type === Actions.extensionStateUpdated) {
        render(msg.state);
    }
});
