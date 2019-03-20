require('source-map-support').install();
import {AccountsConnector} from 'core/accounts-connector';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';

import {ErrorFactoryService} from 'core/error-factory/error-factory.service';
import {LogsConnector} from 'core/logs-connector';
import {Store} from 'core/store';
import {SyncService} from 'core/sync-apps/sync.service';
import {SyncConnector} from 'core/sync-connector';
import {app, Menu, Tray} from 'electron';
import {showAboutDialog} from 'lib/about';
import {getTrayIcon} from 'lib/icon';
import {openSettingsWindow} from 'lib/settings';
import {initThemeSwitcher} from 'lib/theme';


if (!environment.development) {
    console.debug = () => {};
}
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

    if (process.platform === 'darwin') {
        Menu.setApplicationMenu(Menu.buildFromTemplate([
            {
                label: 'Application',
                submenu: [
                    {label: 'About Application', role: 'about:'},
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
                    {label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll'},
                    ...(environment.development ? [
                        {
                            label: 'DevTools',
                            accelerator: 'Option+CmdOrCtrl+I',
                            role: 'toggleDevTools'
                        }
                    ] : [])
                ]
            }
        ]));

    }


    let errorFactory = new ErrorFactoryService(),
        appodealApi = new AppodealApiService(errorFactory),
        store = new Store(
            appodealApi
        ),
        accountsConnector = new AccountsConnector(store),
        logsConnector = new LogsConnector(store, appodealApi),
        syncService = new SyncService(store, appodealApi),
        // syncScheduler = new SyncScheduler(syncService, store),
        syncConnector = new SyncConnector(store, appodealApi, syncService);

    appodealApi.init()
        .then(() => store.appodealFetchUser())
        .then(account => {
            if (account === AppodealApiService.emptyAccount) {
                openSettingsWindow();
            }
        })
        .catch(e => {
            console.error('FAILED TO FETCH CURRENT USER');
            console.log(e);
        });


    const cleanUpOnExit = async function () {
        await accountsConnector.destroy();
        await syncConnector.destroy();
        await logsConnector.destroy();
        await syncService.destroy();
        // await syncScheduler.destroy();
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
