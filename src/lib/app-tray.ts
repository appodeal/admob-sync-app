import {UpdatesConnector} from 'core/updates-connector';
import {Menu, Tray} from 'electron';
import {getDefaultTrayIcon, getSyncingTrayIcon, getWarningTrayIcon} from 'lib/icon';
import {openAboutWindow, openAppodealSignInWindow, openSettingsWindow} from 'lib/ui-windows';


export class AppTray {
    private readonly tray: Tray;
    private warningIconInterval;
    private menu: Menu;


    constructor (private updatesConnector: UpdatesConnector) {
        this.tray = new Tray(getDefaultTrayIcon());
        this.menu = Menu.buildFromTemplate([
            {type: 'normal', label: 'Sign in', click: () => openAppodealSignInWindow(), id: 'sign-in', visible: false},
            {type: 'separator', id: 'sign-in-sep', visible: false},
            {type: 'normal', label: 'Accounts', click: () => openSettingsWindow()},
            {type: 'normal', label: 'Check for updates', click: () => this.updatesConnector.checkForUpdates(false, 'modal')},
            {type: 'normal', label: 'About', click: () => openAboutWindow()},
            {type: 'separator'},
            {type: 'normal', label: 'Quit', role: 'quit'}
        ]);
        this.tray.setContextMenu(this.menu);
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

    showSignIn () {
        this.menu.getMenuItemById('sign-in').visible = true;
        this.menu.getMenuItemById('sign-in-sep').visible = true;
    }

    hideSignIn () {
        this.menu.getMenuItemById('sign-in').visible = false;
        this.menu.getMenuItemById('sign-in-sep').visible = false;
    }


    async destroy () {
        // unsubscribe
    }

}
