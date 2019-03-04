import {ipcRenderer, remote} from 'electron';
import React from 'react';
import ReactDOM from 'react-dom';
import {RootComponent} from '../components/root/RootComponent';
import {WindowsControlsComponent} from '../components/windows-controls/WindowsControlsComponent';
import '../style.scss';
import './settings.scss';


let currentWindow = remote.getCurrentWindow();
ipcRenderer.on('store', (event, storeJson) => {
    if (event.sender !== currentWindow.webContents) {
        let store = JSON.parse(storeJson);
        ReactDOM.render(<RootComponent store={store}/>, document.getElementById('content'));
    }
});
ipcRenderer.send('store');


ReactDOM.render(<WindowsControlsComponent currentWindow={currentWindow}/>, document.getElementById('controls'));

