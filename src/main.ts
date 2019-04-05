require('source-map-support').install();
import {AccountsConnector} from 'core/accounts-connector';
import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {AppodealApi} from 'core/appdeal-api/appodeal-api.factory';
import {AppodealSessions} from 'core/appdeal-api/appodeal-sessions.helper';
import {AuthContext} from 'core/appdeal-api/auth-context';
import {OnlineService} from 'core/appdeal-api/online.service';
import {ErrorFactoryService} from 'core/error-factory/error-factory.service';
import {LogsConnector} from 'core/logs-connector';
import {OnlineConnector} from 'core/online-connector';
import {Store} from 'core/store';
import {SyncService} from 'core/sync-apps/sync.service';
import {SyncConnector} from 'core/sync-connector';
import {UpdatesConnector} from 'core/updates-connector';
import {app} from 'electron';
import {createAppMenu} from 'lib/app-menu';
import {Preferences} from 'lib/app-preferences';
import {AppTray} from 'lib/app-tray';
import {initBugTracker, Sentry} from 'lib/sentry';
import {initThemeSwitcher} from 'lib/theme';
import {openAppodealSignInWindow} from 'lib/ui-windows';
import {TrayIcon} from 'lib/tray-icon';
import {UpdatesService} from 'lib/updates';


if (!environment.development) {
    console.debug = () => {};
}
initBugTracker(environment.sentry);

initThemeSwitcher();

if (app.dock) {
    app.dock.hide();
}
app.on('window-all-closed', () => {});
app.on('ready', async () => {

    let [preferences] = await Promise.all([
            Preferences.load(),
            AppodealSessions.init(),
            AdMobSessions.init(),
            AuthContext.init()
        ]),
        errorFactory = new ErrorFactoryService(),
        appodealApi = new AppodealApi(errorFactory, preferences.accounts.appodealAccounts),
        onlineService = new OnlineService(appodealApi.getDefault()),
        store = new Store(
            appodealApi,
            onlineService,
            preferences
        ),
        updates = new UpdatesService(preferences.updates.lastCheck),
        updatesConnector = new UpdatesConnector(store, updates),
        tray = new AppTray(updatesConnector),
        trayIcon = new TrayIcon(store, tray),
        accountsConnector = new AccountsConnector(store),
        logsConnector = new LogsConnector(store, appodealApi),
        onlineConnector = new OnlineConnector(store),
        syncService = new SyncService(store, appodealApi, onlineService),
        // syncScheduler = new SyncScheduler(syncService, store),
        syncConnector = new SyncConnector(store, syncService);


    onlineService.onceOnline()
        .then(() => {
            if (preferences.accounts.appodealAccounts.length === 0) {
                openAppodealSignInWindow();
            }
        })
        .catch(e => {
            console.error('FAILED TO FETCH CURRENT USER');
            Sentry.captureException(e);
            console.log(e);
        });


    const cleanUpOnExit = () => Promise.all([
        trayIcon.destroy(),
        tray.destroy(),
        onlineConnector.destroy(),
        accountsConnector.destroy(),
        syncConnector.destroy(),
        logsConnector.destroy(),
        syncService.destroy(),
        updatesConnector.destroy(),
        onlineService.destroy()
        // syncScheduler.destroy();
    ]);

    onlineService.online().subscribe(v => {
        console.warn('online', v);
    });


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

    createAppMenu();

    let {checkPeriod, customOptions} = store.state.preferences.updates;
    updatesConnector.checkForUpdates(true, 'notification');
    updatesConnector.runScheduler(checkPeriod, customOptions);
});

