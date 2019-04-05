import {BrowserWindow} from 'electron';
import {AppodealAccountState} from 'interfaces/common.interfaces';
import {openDialogWindow, openWindow} from 'lib/window';


let settingsWindow: BrowserWindow;

export async function openSettingsWindow () {
    if (settingsWindow) {
        settingsWindow.restore();
        settingsWindow.focus();
    } else {
        settingsWindow = await openWindow('./settings.html', {
            fullscreenable: false
        }, () => {
            settingsWindow = null;
        });
    }
}

export function openAppodealSignInWindow (account: AppodealAccountState = null) {
    return openDialogWindow<{ email: string, password: string }>('./sign-in.html', {width: 450, height: 270}, window => {
        window.webContents.send('existingAccount', JSON.stringify(account));

    });
}

export function openAppodealAccountsWindow () {
    return openDialogWindow<{ email: string, password: string }>('./manage-accounts.html', {width: 450, height: 350});
}
