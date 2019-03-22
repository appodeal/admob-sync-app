import {BrowserWindow} from 'electron';
import {openWindow} from 'lib/window';


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
