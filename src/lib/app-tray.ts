import {UpdatesConnector} from 'core/updates-connector';
import {Menu, Tray} from 'electron';
import {showAboutDialog} from 'lib/about';
import {getDefaultTrayIcon} from 'lib/icon';
import {openSettingsWindow} from 'lib/ui-windows';


let INSTANCE: AppTray = null;

class AppTray {
    private readonly tray: Tray;
    private warningIconInterval;

    constructor (private updatesConnector?: UpdatesConnector) {
        if (INSTANCE instanceof AppTray) {
            return INSTANCE;
        } else {
            INSTANCE = this;
        }
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
        this.warningIconInterval = setInterval(() => {

        }, 16);
    }

    setWarningIcon () {
        clearInterval(this.warningIconInterval);
        this.tray.setImage(getDefaultTrayIcon());
    }

    setDefaultIcon () {
        clearInterval(this.warningIconInterval);
        this.tray.setImage(getDefaultTrayIcon());
    }
}

export function createAppTray (updatesConnector: UpdatesConnector) {
    INSTANCE = new AppTray(updatesConnector);
}

export function getAppTray (): AppTray {
    return new AppTray();
}
