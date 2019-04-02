import {UpdatesConnector} from 'core/updates-connector';
import {Menu, Tray} from 'electron';
import {showAboutDialog} from 'lib/about';
import {getDefaultTrayIcon, getSyncingTrayIcon, getWarningTrayIcon} from 'lib/icon';
import {openSettingsWindow} from 'lib/settings';


export class AppTray {
    private readonly tray: Tray;
    private warningIconInterval;


    constructor (private updatesConnector?: UpdatesConnector) {

        this.tray = new Tray(getDefaultTrayIcon());
        this.tray.setContextMenu(Menu.buildFromTemplate([
            {type: 'normal', label: 'Settings', click: () => openSettingsWindow()},
            {type: 'normal', label: 'About', click: () => showAboutDialog()},
            {type: 'normal', label: 'Check for updates', click: () => this.updatesConnector.checkForUpdates(false, 'modal')},
            {type: 'separator'},
            {type: 'normal', label: 'Quit', role: 'quit'}
        ]));
        this.tray.on('click', () => this.tray.popUpContextMenu());
    }


    setProgressIcon () {
        let counter = 1;
        this.warningIconInterval = setInterval(() => {
            counter = (counter) % 4;
            counter++;
            this.tray.setImage(getSyncingTrayIcon(counter));
        }, 250);
        this.tray.setImage(getSyncingTrayIcon(counter));
        console.log('setProgressIcon');
    }

    setWarningIcon () {
        clearInterval(this.warningIconInterval);
        console.log('setWarningIcon');
        this.tray.setImage(getWarningTrayIcon());
    }

    setSyncedIcon () {
        clearInterval(this.warningIconInterval);
        console.log('setSyncedIcon');
        this.tray.setImage(getDefaultTrayIcon());
    }

    setDefaultIcon () {
        clearInterval(this.warningIconInterval);
        this.tray.setImage(getDefaultTrayIcon());
        console.log('setDefaultIcon');
    }


    destroy () {
        // unsubscribe
    }

}
