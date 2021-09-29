import {Actions, TabJobs} from '../../common/actions';


const ADMOB_HOME = 'https://apps.admob.com/logout?continue=https://apps.admob.com/';
const ADMOB_ACCOUNT_ADD_OR_RECONNECT = 'https://app.appodeal.com/apps/linked_networks#AddAdmobAccount';

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
    const tab = await navigateCurrentTab(ADMOB_HOME);
    await setCurrentJob(TabJobs.syncAdunits, tab.id);
}


export async function onClickStartSyncAdmobAccount () {
    await startSyncAdmobAccount();
    setTimeout(() => window.close(), 200);
}

