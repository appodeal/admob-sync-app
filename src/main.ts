require('source-map-support').install();

import {AccountsConnector} from 'core/accounts-connector';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';

import {ErrorFactoryService} from 'core/error-factory/error-factory.service';
import {LogsConnector} from 'core/logs-connector';
import {Store} from 'core/store';
import {SyncConnector} from 'core/sync-connector';
import {app, Menu, Tray} from 'electron';
import {showAboutDialog} from 'lib/about';
import {getTrayIcon} from 'lib/icon';
import {openSettingsWindow} from 'lib/settings';
import {initThemeSwitcher} from 'lib/theme';


if (!environment.development) {
    console.debug = () => {};
}
console.debug('electron versions', process.versions);
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
        appodealApi = new AppodealApiService(errorFactory),
        store = new Store(
            appodealApi
        ),
        accountsConnector = new AccountsConnector(store),
        logsConnector = new LogsConnector(store, appodealApi),
        syncConnector = new SyncConnector(store, appodealApi);


    appodealApi.init()
        .then(() => store.appodealFetchUser())
        .then(account => {
            if (account === AppodealApiService.emptyAccount) {
                openSettingsWindow();
            }
        }).catch(e => {
        console.error('FAILED TO FETCH CURRENT USER');
        console.log(e);
    });


    const cleanUpOnExit = async function () {
        await accountsConnector.destroy();
        await syncConnector.destroy();
        await logsConnector.destroy();
    };


    process.on('SIGTERM', () => app.quit());
    process.on('SIGINT', () => app.quit());
    let cleanUpFinished = false;
    app.on('before-quit', async (e) => {
        console.log('before-quit', cleanUpFinished);
        if (cleanUpFinished) {
            return;
        }
        try {
            e.preventDefault();
            await cleanUpOnExit();
        } finally {
            cleanUpFinished = true;
            app.quit();
        }
    });
});

process.on('uncaughtException', function (err) {
    console.error('Caught exception: ', err);
});
