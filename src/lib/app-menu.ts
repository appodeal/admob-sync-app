import {Menu, MenuItemConstructorOptions} from 'electron';
import {isMacOS} from 'lib/platform';
import {openAboutWindow} from 'lib/ui-windows';


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
                type: 'submenu',
                submenu: [
                    {type: 'normal', label: 'About Application', click: () => openAboutWindow()},
                    {type: 'separator'},
                    {type: 'normal', label: 'Quit', accelerator: 'Command+Q', role: 'quit'}
                ]
            },
            {
                id: 'edit',
                label: 'Edit',
                type: 'submenu',
                submenu: [
                    {type: 'normal', label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo'},
                    {type: 'normal', label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo'},
                    {type: 'separator'},
                    {type: 'normal', label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut'},
                    {type: 'normal', label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy'},
                    {type: 'normal', label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste'},
                    {type: 'normal', label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectall'},
                    ...(environment.development ? [
                        {type: 'normal', label: 'Open DevTools', accelerator: 'CmdOrCtrl+Option+I', role: 'toggledevtools'}
                    ] : [])
                ]
            }
        ] as MenuItemConstructorOptions[]);
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
