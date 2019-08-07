require('source-map-support').install();

import {AboutConnector} from 'core/about-connector';
import {AccountsConnector} from 'core/accounts-connector';
import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {AppodealApi} from 'core/appdeal-api/appodeal-api.factory';
import {AppodealSessions} from 'core/appdeal-api/appodeal-sessions.helper';
import {AuthContext} from 'core/appdeal-api/auth-context';
import {OnlineService} from 'core/appdeal-api/online.service';
import {DeleteDataConnector} from 'core/delete-data-connector';
import {ErrorFactoryService} from 'core/error-factory/error-factory.service';
import {AuthorizationError} from 'core/error-factory/errors/authorization.error';
import {InternalError} from 'core/error-factory/errors/internal-error';
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
import {hideDock} from 'lib/dock';
import {initBugTracker, Sentry} from 'lib/sentry';
import {initThemeSwitcher} from 'lib/theme';
import {TrayIcon} from 'lib/tray-icon';
import {
    closeAllWindows, hasOpenedWindows, openAppodealAccountsWindow, openAppodealSignInWindow, openSettingsWindow, restoreAllWindows
} from 'lib/ui-windows';
import {UpdatesService} from 'lib/updates';
import path from 'path';


const QUIT_DEADLINE_TIMOUT = 5000;

if (environment.development) {
    app.setPath('userData', path.join(process.cwd(), 'tmp/userData'));
}
if (!environment.development) {
    console.debug = () => {};
}
initBugTracker(environment.sentry);

function runApp () {

    async function onRunSecondAppInstance () {
        await app.whenReady();
        if (hasOpenedWindows()) {
            return restoreAllWindows();
        }

        return openSettingsWindow();
    }


    app.on('second-instance', () => {
        // Someone tried to run a second instance, we should focus our window.
        console.log('activation event : ', 'second-instance');
        return onRunSecondAppInstance();
    });

    // override window-all-closed so that app does not close when all windows is closed
    app.on('window-all-closed', () => {});
    // just mac os handlers
    // @see for details https://electronjs.org/docs/api/app#apprequestsingleinstancelock
    ['open-file', 'open-url', 'activate'].forEach((eventName: any) => {
        app.on(eventName, (event) => {
            console.log('activation event : ', eventName);
            event.preventDefault();
            return onRunSecondAppInstance();
        });
    });

    initThemeSwitcher();

    hideDock();

    app.whenReady().then(async () => {

        // APP INITIALIZERS
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
            accountsConnector = new AccountsConnector(store),
            tray = new AppTray(updatesConnector),
            trayIcon = new TrayIcon(store, tray),
            aboutConnector = new AboutConnector(),
            logsConnector = new LogsConnector(store, appodealApi),
            onlineConnector = new OnlineConnector(store),
            syncScheduler = new SyncScheduler(syncService, store, onlineService),
            syncConnector = new SyncConnector(store, syncService),
            deleteDataConnector = new DeleteDataConnector(store, syncService);

        // EVENTS
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
                    if (!acc.active && !store.state.outdatedVersion) {
                        await openAppodealSignInWindow(acc);
                    }
                }
            }
        });

        appodealApi.on('signIn', () => tray.hideSignIn());
        appodealApi.on('signOut', () => tray.showSignIn());

        onlineService.once('online', () => {
            store.validateAppVersion()
                .then(async versionValid => {
                    if (!versionValid) {
                        if (!updates.availableDist) {
                            await updates.check();
                        }
                        if (updates.availableDist) {
                            return updates.availableDist.showUpdateDialog();
                        }
                        return;
                    }
                    await store.fetchAllAppodealUsers();
                    let accounts = store.state.preferences.accounts.appodealAccounts;
                    if (accounts.length === 0) {
                        tray.showSignIn();
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
                .catch(e => {
                    console.error('FAILED TO FETCH CURRENT USER');
                    if (e instanceof InternalError && e.isCritical() || !(e instanceof InternalError)) {
                        Sentry.captureException(e);
                    }
                    onlineService.setOffline();
                    console.log(e);
                })
                .then(() => store.updateUserWhenOnline());
        });

        const cleanUpOnExit = async () => {
            await accountsConnector.destroy().catch(console.error);
            return Promise.all([
                syncService.destroy(),
                closeAllWindows(),
                trayIcon.destroy(),
                tray.destroy(),
                onlineConnector.destroy(),
                aboutConnector.destroy(),
                syncConnector.destroy(),
                logsConnector.destroy(),
                updatesConnector.destroy(),
                onlineService.destroy(),
                syncScheduler.destroy(),
                deleteDataConnector.destroy()
            ]);
        };

        onlineService.on('statusChange', isOnline => {
            console.warn('online', isOnline);
        });


        process.on('SIGTERM', () => app.quit());
        process.on('SIGINT', () => app.quit());

        let cleanUpFinished = false;
        app.on('before-quit', async (e) => {
            app.releaseSingleInstanceLock();
            setTimeout(() => {
                cleanUpFinished = true;
                console.warn('Quit by timeout');
                setTimeout(() => app.quit());
            }, QUIT_DEADLINE_TIMOUT);
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

}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    // attempt to run second instance
    // run away
    app.quit();
} else {
    runApp();
}
