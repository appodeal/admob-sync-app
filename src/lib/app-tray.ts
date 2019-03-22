import {Menu, Tray} from 'electron';
import {showAboutDialog} from 'lib/about';
import {getDefaultTrayIcon} from 'lib/icon';
import {openSettingsWindow} from 'lib/settings';


let INSTANCE: AppTray = null;

class AppTray {
    private readonly tray: Tray;
    private warningIconInterval;

    constructor () {
        if (INSTANCE instanceof AppTray) {
            return INSTANCE;
        } else {
            INSTANCE = this;
        }
        this.tray = new Tray(getDefaultTrayIcon());
        this.tray.setContextMenu(Menu.buildFromTemplate([
            {type: 'normal', label: 'Settings', click: () => openSettingsWindow()},
            {type: 'normal', label: 'About', click: () => showAboutDialog()},
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

export function createAppTray () {
    INSTANCE = new AppTray();
}

export function getAppTray (): AppTray {
    return new AppTray();
}
