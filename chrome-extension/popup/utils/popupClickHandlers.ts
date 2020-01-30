import {Actions, TabJobs} from '../../common/actions';
import {extLocalStorage} from '../../common/localstorage';


const GOOGLE_CLOUD_CONSOLE = 'https://apps.admob.com/logout?continue=https://apps.admob.com/#home';

const ADMOB_HOME = 'https://apps.admob.com/logout?continue=https://apps.admob.com/';

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


export async function startAdmobAccountSetup () {
    const tab = await navigateCurrentTab(GOOGLE_CLOUD_CONSOLE);
    await setCurrentJob(TabJobs.enableReporting, tab.id);
    // for legacy script to obtain tabId
    await extLocalStorage.set({'reporting_tab_id': tab.id});
}


/**
 * @deprecated
 */
export async function onClickStartAdmobAccountSetup () {
    await startAdmobAccountSetup();
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

