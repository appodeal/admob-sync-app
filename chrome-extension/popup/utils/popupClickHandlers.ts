import {Actions, TabJobs} from '../../common/actions';


const ADMOB_HOME_WITH_RELOGIN = 'https://admob.google.com/accounts/ClearOSID?continue=https://admob.google.com/v2';
const ADMOB_ACCOUNT_ADD_OR_RECONNECT = 'https://app.appodeal.com/integrations/mediation_ad_networks';
const ADMOB_HOME = 'https://admob.google.com/v2/home?pli=1';
const ADMOB_DASHBOARD_ROOT = 'https://admob.google.com/v2/home';

async function navigateCurrentTab (url: string): Promise<chrome.tabs.Tab> {
    return new Promise(resolve => {
        chrome.tabs.update({url}, (tab => {
            if (chrome.runtime.lastError) {
                console.warn(chrome.runtime.lastError);
            }
            resolve(tab);
        }));
    });
}

async function setCurrentJob (job: TabJobs, tabId: number) {
    return new Promise(resolve => {
            chrome.runtime.sendMessage({
                type: Actions.runJob,
                job,
                tabId
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn(chrome.runtime.lastError);
                }
                setTimeout(resolve);
            });
        }
    );
}

export async function onClickStartAdmobAccountSetup () {
    await navigateCurrentTab(ADMOB_ACCOUNT_ADD_OR_RECONNECT);
    setTimeout(() => {window.close();}, 200);
}


export async function startSyncAdmobAccount () {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    const tab = tabs[0];
    if (tab.url && tab.url.startsWith(ADMOB_DASHBOARD_ROOT)) {
        await chrome.tabs.update(tab.id, {url: ADMOB_HOME});
    } else {
        await chrome.tabs.update(tab.id, {url: ADMOB_HOME_WITH_RELOGIN});
    }
    await setCurrentJob(TabJobs.syncAdunits, tab.id);
}


export async function onClickStartSyncAdmobAccount () {
    await startSyncAdmobAccount();
    setTimeout(() => window.close(), 200);
}

