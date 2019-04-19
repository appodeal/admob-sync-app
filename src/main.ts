import {AboutConnector} from "core/about-connector";

require('source-map-support').install();
import {AccountsConnector} from 'core/accounts-connector';
import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {AppodealApi} from 'core/appdeal-api/appodeal-api.factory';
import {AppodealSessions} from 'core/appdeal-api/appodeal-sessions.helper';
import {AuthContext} from 'core/appdeal-api/auth-context';
import {OnlineService} from 'core/appdeal-api/online.service';
import {ErrorFactoryService} from 'core/error-factory/error-factory.service';
import {AuthorizationError} from 'core/error-factory/errors/authorization.error';
import {LogsConnector} from 'core/logs-connector';
import {OnlineConnector} from 'core/online-connector';
import {Store} from 'core/store';
import {SyncScheduler} from 'core/sync-apps/sync-scheduler';
import {SyncService} from 'core/sync-apps/sync.service';
import {SyncConnector} from 'core/sync-connector';
import {UpdatesConnector} from 'core/updates-connector';
import {app} from 'electron';
import {createAppMenu} from 'lib/app-menu';
import {Preferences} from 'lib/app-preferences';
import {AppTray} from 'lib/app-tray';
import {initBugTracker, Sentry} from 'lib/sentry';
import {initThemeSwitcher} from 'lib/theme';
import {TrayIcon} from 'lib/tray-icon';
import {openAppodealAccountsWindow, openAppodealSignInWindow} from 'lib/ui-windows';
import {UpdatesService} from 'lib/updates';
import * as path from 'path';


if (environment.development) {
    app.setPath('userData', path.join(process.cwd(), 'userData'));
}
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
        onlineService = new OnlineService(appodealApi),
        store = new Store(
            appodealApi,
            onlineService,
            preferences
        ),
        updates = new UpdatesService(preferences.updates.lastCheck),
        updatesConnector = new UpdatesConnector(store, updates),
        syncService = new SyncService(store, appodealApi, onlineService),
        tray = new AppTray(updatesConnector),
        trayIcon = new TrayIcon(store, tray),
        accountsConnector = new AccountsConnector(store),
        aboutConnector = new AboutConnector(),
        logsConnector = new LogsConnector(store, appodealApi),
        onlineConnector = new OnlineConnector(store),
        syncScheduler = new SyncScheduler(syncService, store, onlineService),
        syncConnector = new SyncConnector(store, syncService);

    appodealApi.onError.subscribe(async ({account, error}) => {
        if (error instanceof AuthorizationError && !error.isHandled) {
            await store.patchPreferences({
                accounts: {
                    appodealAccounts: store.state.preferences.accounts.appodealAccounts.map(acc => {
                        if (acc.id === account.id) {
                            acc.active = false;
                        }
                        return acc;
                    })
                }
            });
            for (let acc of store.state.preferences.accounts.appodealAccounts) {
                if (!acc.active) {
                    await openAppodealSignInWindow(acc);
                }
            }
        }
    });

    onlineService.once('online', () => {
        store.validateAppVersion()
            .then(async versionValid => {
                if (!versionValid) {
                    updates.availableDist.showUpdateDialog();
                    return;
                }
                await store.fetchAllAppodealUsers();
                let accounts = store.state.preferences.accounts.appodealAccounts;
                if (accounts.length === 0) {
                    openAppodealSignInWindow();
                } else {
                    let problemAccount = accounts.find(acc => !acc.active);
                    if (problemAccount) {
                        if (preferences.multipleAccountsSupport) {
                            openAppodealAccountsWindow();
                        } else {
                            openAppodealSignInWindow(problemAccount);
                        }
                    }
                }
            })
            .then(() => store.updateUserWhenOnline())
            .catch(e => {
                console.error('FAILED TO FETCH CURRENT USER');
                Sentry.captureException(e);
                console.log(e);
            });
    });


    const cleanUpOnExit = () => Promise.all([
        trayIcon.destroy(),
        tray.destroy(),
        onlineConnector.destroy(),
        accountsConnector.destroy(),
        aboutConnector.destroy(),
        syncConnector.destroy(),
        logsConnector.destroy(),
        syncService.destroy(),
        updatesConnector.destroy(),
        onlineService.destroy(),
        syncScheduler.destroy()
    ]);

    onlineService.on('statusChange', isOnline => {
        console.warn('online', isOnline);
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

