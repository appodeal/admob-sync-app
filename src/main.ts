require('source-map-support').install();
import * as Sentry from '@sentry/electron';
import {SentryEvent} from '@sentry/electron';
import {init} from '@sentry/electron/dist/main';
import {SentryEventHint} from '@sentry/types';
import {AccountsConnector} from 'core/accounts-connector';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {ErrorFactoryService} from 'core/error-factory/error-factory.service';
import {LogsConnector} from 'core/logs-connector';
import {Store} from 'core/store';
import {SyncService} from 'core/sync-apps/sync.service';
import {SyncConnector} from 'core/sync-connector';
import {UpdatesConnector} from 'core/updates-connector';
import {app} from 'electron';
import {createAppMenu} from 'lib/app-menu';
import {Preferences} from 'lib/app-preferences';
import {createAppTray} from 'lib/app-tray';
import {openSettingsWindow} from 'lib/settings';
import {initThemeSwitcher} from 'lib/theme';
import {UpdatesService} from 'lib/updates';


if (!environment.development) {
    console.debug = () => {};
}
const useSentry = environment.sentry && environment.sentry.dsn;
if (useSentry) {
    init({
        ...environment.sentry,
        beforeSend (event: SentryEvent, hint?: SentryEventHint): SentryEvent {
            // to extend error context
            if (hint && hint.originalException) {
                if (hint.originalException['extraInfo']) {
                    event.extra = {...(event.extra || {}), ...hint.originalException['extraInfo']};
                }
            }
            return event;
        }
    });
} else {
    process.on('uncaughtException', function (err: any) {
        console.error('Caught exception: ', err);
    });
    process.on('unhandledRejection', (reason, p) => {
        console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
        // application specific logging, throwing an error, or other logic here
    });
}

initThemeSwitcher();

if (app.dock) {
    app.dock.hide();
}
app.on('window-all-closed', () => {});
app.on('ready', async () => {

    let preferences = await Preferences.load(),
        errorFactory = new ErrorFactoryService(),
        appodealApi = new AppodealApiService(errorFactory),
        store = new Store(appodealApi, preferences),
        accountsConnector = new AccountsConnector(store),
        logsConnector = new LogsConnector(store, appodealApi),
        syncService = new SyncService(store, appodealApi),
        // syncScheduler = new SyncScheduler(syncService, store),
        syncConnector = new SyncConnector(store, appodealApi, syncService),
        updates = new UpdatesService(preferences.updates.lastCheck),
        updatesConnector = new UpdatesConnector(store, updates);

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


    const cleanUpOnExit = () => Promise.all([
        accountsConnector.destroy(),
        syncConnector.destroy(),
        logsConnector.destroy(),
        syncService.destroy(),
        updatesConnector.destroy()
        // syncScheduler.destroy();
    ]);


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


    createAppTray(updatesConnector);
    createAppMenu();

    let {checkPeriod, customOptions} = store.state.preferences.updates;
    updatesConnector.checkForUpdates(true, 'notification');
    updatesConnector.runScheduler(checkPeriod, customOptions);
});

