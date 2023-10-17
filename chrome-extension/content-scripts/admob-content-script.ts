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
            Syncing ${
                Number(syncProgress.percent).toFixed(0)
            }% ${
                Math.min(syncProgress.completedApps + syncProgress.failedApps + 1, syncProgress.totalApps)
            }/${syncProgress.totalApps} <div class="loading">apps...</div>
            <div style="height: 200px; width: 100%; min-width: 0; margin: 10px 0; background: #4d4d4d; color: #fff; display: flex; flex-direction: column; justify-content: flex-end;">
                 <div id="console-area" style="overflow: auto; padding: 10px;"></div>       
            </div><style>.loading {display:inline-block;clip-path: inset(0 1.5ch 0 0);animation: l 1s steps(5) infinite;}@keyframes l {to {clip-path: inset(0 -1ch 0 0)}}</style>`
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

        let logBlock = window.document.getElementById('console-area');
        if (logBlock) {
            logBlock.innerHTML = `${logBlock.innerHTML} <p>${request.message}</p>`;
            logBlock.scrollTop = logBlock.scrollHeight;
        }

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
