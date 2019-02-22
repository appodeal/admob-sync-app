import {app, BrowserWindow, systemPreferences} from 'electron';


systemPreferences.setAppLevelAppearance(systemPreferences.isDarkMode() ? 'dark' : 'light');
systemPreferences.on('appearance-changed', appearance => {
    systemPreferences.setAppLevelAppearance(appearance);
});

function createWindow () {
    // Создаем окно браузера.
    let win = new BrowserWindow({
        width: 600,
        height: 500,
        minWidth: 600,
        minHeight: 500,
        frame: false,
        titleBarStyle: 'hiddenInset',
        fullscreenWindowTitle: false,
        webPreferences: {
            nodeIntegration: true
        },
        show: false
    });

    // and load the index.html of the app.
    win.loadFile(environment.settingsPage);

    win.once('ready-to-show', () => win.show());

    win.on('enter-full-screen', () => {

    });

}

app.on('ready', createWindow);
