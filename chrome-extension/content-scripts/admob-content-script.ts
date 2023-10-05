import {extractAccountInfo} from 'core/admob-api/extract-admob-account-info';
import {Actions} from '../common/actions';


console.log(`i'm here`, chrome.runtime.id);
// to prevent background script from suspending
let pingIntervalId;

function pingBackgroundScript () {
    chrome.runtime.sendMessage({type: Actions.ping, time: Date.now()});
}

if (document.location.pathname.startsWith('/v2')) {
    let extractedAccount;
    try {
        extractedAccount = extractAccountInfo(document.body.parentElement.innerHTML);
    } catch (e) {
    }
    if (extractedAccount) {
        chrome.runtime.sendMessage({type: Actions.openAdmobTab, admobAccount: extractedAccount});
    }
}

declare var $: any, Modal;

$(document).ready(function () {
    let modal: { show: (title: string, html: string) => void };
    const title = 'Appodeal Chrome Extension';

    chrome.runtime.onMessage.addListener((request) => {
        globalThis.Sentry.withScope(scope => {
            scope.setExtra('request', request);
            onMessage(request);
        });
    });
    console.debug('[SYNC progress] check');
    chrome.runtime.sendMessage({type: 'isSyncProgressVisible'}, (isVisbble) => {
        console.debug('[SYNC progress] is popup visible', isVisbble);
        if (isVisbble) {
            onStart();
        }
    });

    function onStart () {
        pingBackgroundScript();
        pingIntervalId = setInterval(pingBackgroundScript, 500);
        // @see legacy/js/modal.js
        modal = new Modal();
        modal.show(title, 'Start sync inventory');
    }

    function onUpdateProgress (syncProgress) {
        if (!syncProgress.totalApps) {
            // progress is calculating
            return;
        }
        modal.show(
            title,
            `
            ${syncProgress.step ? 'Step of sync: ' + syncProgress.step + ' of 3 ...' : ''}
            <br>
            Syncing ${
                Number(syncProgress.percent).toFixed(0)
            }% ${
                Math.min(syncProgress.completedApps + syncProgress.failedApps + 1, syncProgress.totalApps)
            }/${syncProgress.totalApps} apps...`
        );
    }

    function onFinish (message) {
        clearInterval(pingIntervalId);
        modal.show(title, message);
    }


    function onMessage (request) {
        if (!modal) {
            return;
        }
        console.debug('[SYNC] onMessage', request);

        if (request.type === Actions.syncLogMessage) {
            return console.log(request.message);
        }
        if (request.type === Actions.syncProgressUpdated) {
            return onUpdateProgress(request.syncProgress);
        }
        if (request.type === Actions.syncProgressFinishMessage) {
            return onFinish(request.message);

        }
    }

});
