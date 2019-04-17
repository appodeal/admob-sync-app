import {Menu} from 'electron';
import {showAboutDialog} from 'lib/about';
import {isMacOS} from 'lib/platform';


let INSTANCE: AppMenu = null;

class AppMenu {
    private readonly menu: Menu;

    constructor () {
        if (INSTANCE instanceof AppMenu) {
            return INSTANCE;
        } else {
            INSTANCE = this;
        }
        this.menu = Menu.buildFromTemplate([
            {
                label: 'Application',
                submenu: [
                    {label: 'About Application', click: () => showAboutDialog()},
                    {type: 'separator'},
                    {label: 'Quit', accelerator: 'Command+Q', role: 'quit'}
                ]
            }, {
                id: 'edit',
                label: 'Edit',
                submenu: [
                    {label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo'},
                    {label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo'},
                    {type: 'separator'},
                    {label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut'},
                    {label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy'},
                    {label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste'},
                    {label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll'}
                ]
            }
        ]);
        if (isMacOS()) {
            Menu.setApplicationMenu(this.menu);
        }
    }
}

export function createAppMenu () {
    INSTANCE = new AppMenu();
}

export function getAppMenu () {
    return new AppMenu();
}
