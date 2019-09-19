import {extLocalStorage} from '../../common/localstorage';


export function injectScript (tabId: number, url: string) {
    chrome.tabs.executeScript(tabId, {
        file: url
    }, () => {
        if (chrome.runtime.lastError) {
            console.warn(chrome.runtime.lastError);
        }
    });
}


export function legacyOnOpenAdmobPage (tabId: number) {
    injectScript(tabId, 'js/get_admob_account.js');
}

export async function legacyWebNavigationHandler (details) {
    // this is value is used in legacy scripts
    // so that it supposed to be set in sorage
    const result = await extLocalStorage.get('reporting_tab_id');
    if (!result || !result['reporting_tab_id'] || String(details.tabId) !== String(result['reporting_tab_id'])) {
        return;
    }
    var details_url = details.url.toString();
    if (details_url.match(/\/apiui\/credential/) || details_url.match(/credentials\?project=/) || details_url.match(
        /credentials\/oauthclient\?project=/) || details_url.match(/credentials\?highlightClient=/) || details_url.match(
        /apis\/credentials\/oauthclient\//)) {
        return injectScript(details.tabId, 'js/reporting_step4.js');
    }

    if (details_url.match(/\/apiui\/consent/) || details_url.match(/consent\?project=/)) {
        return injectScript(details.tabId, 'js/reporting_step3.js');
    }

    if (details_url.startsWith('https://apps.admob.com/v2')) {
        return injectScript(details.tabId, 'js/get_admob_account.js');
    }

    if (details_url.match(/adsense\/overview/) || details_url.match(/adsensehost.googleapis.com/) || details_url.match(
        /adsense.googleapis.com/)) {
        return injectScript(details.tabId, 'js/reporting_step2.js');
    }

    if ([`/projectselector2/apis/credentials`, `/projectselector/apis/credentials`].some(path => details_url.match(path))) {
        return injectScript(details.tabId, 'js/library.js');
    }
}
