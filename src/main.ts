require('source-map-support').install();
import {AccountsConnector} from 'core/accounts-connector';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {ErrorFactoryService} from 'core/error-factory/error-factory.service';
import {LogsConnector} from 'core/logs-connector';
import {Store} from 'core/store';
import {SyncService} from 'core/sync-apps/sync.service';
import {SyncConnector} from 'core/sync-connector';
import {app} from 'electron';
import {createAppMenu} from 'lib/app-menu';
import {createAppTray} from 'lib/app-tray';
import {initBugTracker, Sentry} from 'lib/sentry';
import {openSettingsWindow} from 'lib/settings';
import {initThemeSwitcher} from 'lib/theme';


if (!environment.development) {
    console.debug = () => {};
}
initBugTracker(environment.sentry);

initThemeSwitcher();

if (app.dock) {
    app.dock.hide();
}
app.on('window-all-closed', () => {});
app.on('ready', () => {
    createAppTray();
    createAppMenu();

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
            Sentry.captureException(e);
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
            setTimeout(() => app.quit());
        }
    });
});

