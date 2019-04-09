import {AppodealAccount} from 'core/appdeal-api/interfaces/appodeal.account.interface';
import {BrowserWindow} from 'electron';
import {AppodealAccountState} from 'interfaces/common.interfaces';
import {openDialogWindow, openWindow} from 'lib/window';


const OPENED_WINDOWS = new Map<string, BrowserWindow | Promise<BrowserWindow>>();

export async function openSettingsWindow () {
    return openOrFocus('settings', () => {
        return openWindow('./settings.html', {
            fullscreenable: false
        });
    });
}


export function openAppodealSignInWindow (account: AppodealAccountState = null): Promise<AppodealAccount> {
    return new Promise((resolve, reject) => {
        openOrFocus('sign-in', () => new Promise(res => {
            openDialogWindow<AppodealAccount>('./sign-in.html', {width: 450, height: 270}, window => {
                window.webContents.send('existingAccount', JSON.stringify(account));
                res(window);
            }).then(resolve, reject);
        }));
    });
}

export function openAppodealAccountsWindow (): Promise<void> {
    return new Promise((resolve, reject) => {
        openOrFocus('accounts', () => new Promise(res => {
            openDialogWindow('./manage-accounts.html', {width: 450, height: 350}, res)
                .then(resolve, reject);
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
        window.once('close', () => OPENED_WINDOWS.delete(windowName));
        return window;
    }
}
