import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {AuthContext} from 'core/appdeal-api/auth-context';
import {AppodealAccount} from '../../src/core/appdeal-api/interfaces/appodeal.account.interface';
import {ErrorFactoryService} from '../../src/core/error-factory/error-factory.service';
import {AuthorizationError} from '../../src/core/error-factory/errors/authorization.error';
import {LocalStorageJsonStorage} from '../../src/core/json-storage/local-storage.json-storage';
import {Actions, TabJobs} from '../common/actions';
import {InitSentry} from '../common/initSentry';
import {EnableReportingTabJob} from './jobs/enable-reporting.tab.job';


import {GetCurrentUserBackgroundJob} from './jobs/get-current-user.background.job';
import {RunSyncTabJob} from './jobs/run-sync.tab.job';
import {localStorageProxy} from './utils/local-storage.proxy';
import {getExtensionVersion} from './utils/minimal-version';
import {notify, notifyError} from './utils/notifications';


console.log('Plugin background script loaded', getExtensionVersion());

const sentry = InitSentry('background', false);

export interface ExtensionState {
    isFetchingCurrentUser: boolean;
    tabsJob: TabJobs;
    tabId: number | null;
    tabAdmobAccountEmail: string | null;
    tabAdmobAccountId: string | null;
    currentUser: AppodealAccount | null;
    minimalVersion: string | null,
    updateRequired: boolean
}

export class App {
    public readonly environment = environment;
    public readonly errorFactory = new ErrorFactoryService();
    public readonly api = new AppodealApiService(this.errorFactory, fetch.bind(globalThis));
    public loadingUser: GetCurrentUserBackgroundJob;
    public enablingReports: EnableReportingTabJob;
    public runningSync: RunSyncTabJob;
    public state: ExtensionState = localStorageProxy('state', {
        isFetchingCurrentUser: false,
        tabsJob: TabJobs.Idle,
        tabId: null,
        tabAdmobAccountEmail: null,
        tabAdmobAccountId: null,
        currentUser: null,
        minimalVersion: null,
        updateRequired: false
    }, ['isFetchingCurrentUser']);

    public readonly notify = notify;
    public readonly sentry = sentry;

    async run (jobClass) {
        const instance = new jobClass(this);
        console.debug('[RUN job]', instance.constructor.name);
        const canRun = typeof instance.canRun !== 'function' || (await instance.canRun());
        console.debug('[RUN job] canRun', canRun);
        if (!canRun) {
            return;
        }
        try {
            const result = await instance.before();
            console.debug('[RUN job] before result', result);
            this.updateSentry();
            await instance.run();
        } catch (e) {
            console.error('[RUN job] RUN Error', e);
            throw e;
        } finally {
            this.updateSentry();
            console.debug('[RUN job] after');
            await instance.after().catch(e => {
                console.error('[RUN job] after Error');
                console.error(e);
            });

        }
    }

    async start () {
        console.debug('[APP] Starting');
        await AuthContext.init(new LocalStorageJsonStorage());
        console.debug('[APP] Auth Context loaded');

        await app.run(GetCurrentUserBackgroundJob);
        app.api.onError.subscribe(e => {
            if (e instanceof AuthorizationError) {
                app.state.currentUser = null;
                app.api.authContext.remove();
            }
        });
    }

    updateSentry () {
        const {currentUser, ...extra} = this.state;
        this.sentry.configureScope(scope => {
            scope.setExtra('state', extra);
            scope.setTag('where', 'background');
            scope.setUser(currentUser);
        });
    }
}

const app = new App();
app.start();


//// FOR DEBUG PURPOSE /////
globalThis.app = app;


function onMessage (request, sender) {

    console.log('onMessage', request.type, request, sender);

    if (request.type === Actions.fetch) {
        return onExternalFetch(request, sender);
    }

    if (request.type === Actions.getEnv) {
        return app.environment;
    }

    if (request.type === Actions.isSyncProgressVisible) {
        return app.state.tabsJob === TabJobs.syncAdunits && app.state.tabId === sender.tab.id;
    }

    if (request.type === Actions.updateAdmobAccountCredentialsOAuthCallbackVisited) {
        reloadCurrentUser();
        return;
    }

    if (request.type === Actions.getExtensionState) {
        setTimeout(() => reloadCurrentUser());
        return app.state;
    }

    if (!app.state.currentUser) {
        const message = `[onMessage]  no current User for this events`;
        console.warn(message);
        app.sentry.captureMessage(message);
        return;
    }

    if (request.type === Actions.runJob) {
        return startTabsJob(request.job, request.tabId);
    }

    if (request.type === Actions.updateAdmobAccountCredentials) {
        app.enablingReports.onUpdateAdmobAccountCredential(request);
        return;
    }

    if (request.type === Actions.openAdmobTab) {
        if (app.state.tabId !== sender.tab.id) {
            console.log(`activeTabId ${app.state.tabId} ignore event from ${sender.tab.id} tab`);
            return;
        }

        app.state.tabAdmobAccountEmail = request.admobAccount.email;
        app.state.tabAdmobAccountId = request.admobAccount.id;

        if (app.state.tabsJob === TabJobs.enableReporting) {
            app.run(EnableReportingTabJob);
            return;
        }

        if (app.state.tabsJob === TabJobs.syncAdunits) {
            app.run(RunSyncTabJob);
            return;
        }
    }

}

function reloadCurrentUser () {
    app.run(GetCurrentUserBackgroundJob).catch(notifyError);
}

function checkJob () {
    if (app.state.tabsJob !== TabJobs.Idle && !app.runningSync && !app.enablingReports) {
        console.debug(`[CHECK JOB] steel waiting tab reaction`);
    }
}

let intervalID;

function startTabsJob (job: TabJobs, tabId?: number | null) {
    console.log(`[RUN JOB] starting new job ${job} for tab ${tabId}`);
    clearInterval(intervalID);

    if (app.state.updateRequired && job !== TabJobs.Idle) {
        return startTabsJob(TabJobs.Idle);
    }

    if (job !== TabJobs.Idle) {
        intervalID = setInterval(checkJob, 1000);
    }

    app.state.tabAdmobAccountEmail = null;
    app.state.tabAdmobAccountId = null;

    if (app.state.tabsJob === job) {
        console.debug(`[RUN JOB] re run job in ${app.state.tabId === tabId ? 'same' : 'another'} tab`);
        if (app.runningSync) {
            console.debug('[RUN JOB] cancel running sync');
            app.runningSync.cancel();
        }
    }

    if (app.state.tabsJob === TabJobs.Idle) {
        chrome.tabs.onRemoved.addListener(waitTabToClose);
    }

    app.state.tabsJob = job;
    app.state.tabId = tabId;
    if (TabJobs.Idle === job) {
        app.state.tabId = null;
        chrome.tabs.onRemoved.removeListener(waitTabToClose);
    }
}


const waitTabToClose = tabId => {
    app.sentry.withScope(scope => {
        if (tabId === app.state.tabId) {
            console.log('[TAB] active tab with job closed');

            if (app.runningSync) {
                console.debug('[TAB] canceling active sync');
                app.runningSync.cancel();
            }

            startTabsJob(TabJobs.Idle);
        }
    });
};


function errorToJson (e) {
    const clone = Object.assign({}, e);
    ['name', 'message', 'stack', 'userMessage'].forEach(name => clone[name] = e[name]);
    return JSON.parse(JSON.stringify(clone));
}

function onExternalFetch (request, sender) {

    fetch(request.url, Object.assign({}, {
            credentials: 'include',
            mode: 'cors'
        }, JSON.parse(request.options))
    )
        .then(res => res.text())
        .then(text => {
            chrome.tabs.sendMessage(sender.tab.id, {type: 'fetchResult', id: request.id, ok: true, result: text});
        })
        .catch(e => {
            chrome.tabs.sendMessage(
                sender.tab.id,
                {type: 'fetchResult', id: request.id, ok: false, result: errorToJson(e)}
            );
        });
}

console.debug('[APP] Attaching global message listener');
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    app.sentry.withScope(scope => {
        scope.setExtra('request', request);
        scope.setExtra('sender', sender);
        return sendResponse(onMessage(request, sender));
    });
});
console.debug('[APP] Global message listener is attached');

