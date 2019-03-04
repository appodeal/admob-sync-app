import {AccountsConnector} from 'core/accounts-connector';
import {AppodealApiService} from 'core/appodeal/api/appodeal.api';
import {AdmobApiService} from 'core/admob-api/admob.api';
import {ErrorFactoryService} from 'core/error-factory/error-factory.service';
import {Store} from 'core/store';
import {app, BrowserWindow, Menu, Tray} from 'electron';
import {showAboutDialog} from 'lib/about';
import {openWindow} from 'lib/common';
import {getTrayIcon} from 'lib/icon';
import {openSettingsWindow} from 'lib/settings';
import {initThemeSwitcher} from 'lib/theme';


let tray: Tray;


initThemeSwitcher();

if (app.dock) {
    app.dock.hide();
}

app.on('window-all-closed', () => {


});

app.on('ready', () => {

    tray = new Tray(getTrayIcon());

    let menu = Menu.buildFromTemplate([
        {type: 'normal', label: 'Settings', click: () => openSettingsWindow()},
        {type: 'normal', label: 'About', click: () => showAboutDialog()},
        {type: 'separator'},
        {type: 'normal', label: 'Quit', click: () => app.quit()}
    ]);

    tray.setContextMenu(menu);


    let errorFactory = new ErrorFactoryService(),
        store = new Store(
            new AppodealApiService(errorFactory),
            new AdmobApiService(errorFactory)
        ),
        accountsConnector = new AccountsConnector(store);

    store.appodealFetchUser().then(account => {
        if (account === AppodealApiService.emptyAccount) {
            openSettingsWindow();
        }
    });

});
