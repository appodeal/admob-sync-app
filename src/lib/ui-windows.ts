import {AppodealAccount} from 'core/appdeal-api/interfaces/appodeal.account.interface';
import {app, BrowserWindow} from 'electron';
import {AppodealAccountState} from 'interfaces/common.interfaces';
import {getMapItem} from 'lib/core';
import {openDialogWindow, openWindow} from 'lib/window';


const OPENED_WINDOWS = new Map<string, BrowserWindow | Promise<BrowserWindow>>();

export async function openSettingsWindow () {
    return openOrFocus('settings', async () => {
        let window = await openWindow('./settings.html', {
            fullscreenable: false,
            skipTaskbar: false
        }, () => {
            app.dock.hide();
            window.removeAllListeners();
        });
        app.dock.show();
        window.on('focus', async event => {
            let topWindow = getMapItem(OPENED_WINDOWS, OPENED_WINDOWS.size - 1);
            if (topWindow) {
                event.preventDefault();
            }
            if (topWindow instanceof Promise) {
                topWindow = await topWindow;
            }
            if (topWindow) {
                topWindow.focus();
            }
        });
        return window;
    });
}

export function openClearDataWindow () {
    return openDialogWindow('./clear-data.html', {
        width: 350,
        height: 220,
        parent: null
    });
}

export function openAboutWindow () {
    return openOrFocus('about', () => openWindow('./about.html', {
        frame: true,
        width: 450,
        titleBarStyle: 'default',
        height: 270,
        parent: null
    }));
}

export function openAppodealSignInWindow (account: AppodealAccountState = null): Promise<AppodealAccount> {
    return new Promise((resolve, reject) => {
        openOrFocus('sign-in', () => new Promise(async res => {
            openDialogWindow<AppodealAccount>(
                './sign-in.html',
                {width: 450, height: 270, parent: await OPENED_WINDOWS.get('settings')},
                window => {
                    let parent = window.getParentWindow();
                    app.dock.show();
                    window.once('closed', () => {
                        if (!parent) {
                            app.dock.hide();
                        }
                    });
                    window.webContents.send('existingAccount', JSON.stringify(account));
                    res(window);
                }
            ).then(resolve, reject);
        }));
    });
}

export function openAppodealAccountsWindow (): Promise<void> {
    return new Promise((resolve, reject) => {
        openOrFocus('accounts', () => new Promise(async res => {
            openDialogWindow(
                './manage-accounts.html',
                {width: 450, height: 350, parent: await OPENED_WINDOWS.get('settings')},
                window => {
                    let parent = window.getParentWindow();
                    app.dock.show();
                    window.once('closed', () => {
                        if (!parent) {
                            app.dock.hide();
                        }
                    });
                    res(window);
                }
            ).then(resolve, reject);
        }));
    });

}

async function openOrFocus (windowName: string, openFunction: () => BrowserWindow | Promise<BrowserWindow>): Promise<BrowserWindow> {
    if (OPENED_WINDOWS.has(windowName)) {
        let window = OPENED_WINDOWS.get(windowName);
        if (window instanceof Promise) {
            window = await window;
        }
        window.restore();
        window.focus();
        return window;
    } else {
        let openResult = openFunction(),
            window: BrowserWindow;
        if (openResult instanceof Promise) {
            OPENED_WINDOWS.set(windowName, openResult);
            window = await openResult;
            OPENED_WINDOWS.set(windowName, window);
        } else {
            window = openResult;
        }
        OPENED_WINDOWS.set(windowName, window);
        window.on('closed', () => {
            OPENED_WINDOWS.delete(windowName);
            window.removeAllListeners('close');
        });
        return window;
    }
}
