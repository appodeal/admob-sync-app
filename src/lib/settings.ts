import {openWindow} from 'lib/common';
import {BrowserWindow} from 'electron';


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
