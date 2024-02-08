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
        modal.show(
            title,
            `<h4>Start sync inventory</h4>
                  <div style="display: flex; align-items: flex-start; justify-content: flex-start;">
                    <svg style="margin-right: 8px; margin-top: 6px" width="16px" height="16px" fill="#f25b0c" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path fill-rule="evenodd" d="M13.1784199,2.2788327 C13.6884947,2.53387012 14.102091,2.94746641 14.3571284,3.45754124 L21.7211673,18.185619 C22.37215,19.4875845 21.8444243,21.0707619 20.5424588,21.7217447 C20.1764813,21.9047334 19.7729254,22 19.3637502,22 L4.63567242,22 C3.18003074,22 2,20.8199693 2,19.3643276 C2,18.9551524 2.09526662,18.5515965 2.27825534,18.185619 L9.64229424,3.45754124 C10.293277,2.15557574 11.8764544,1.62784995 13.1784199,2.2788327 Z M11.2372377,4.47154211 L4.09002086,18.7659757 C4.03082055,18.8843764 4,19.0149343 4,19.1473102 C4,19.6182378 4.38176222,20 4.85268979,20 L19.1471234,20 C19.2794993,20 19.4100573,19.9691794 19.5284579,19.9099791 C19.9496683,19.6993739 20.1203976,19.1871862 19.9097924,18.7659757 L12.7625755,4.47154211 C12.6800661,4.30652327 12.5462599,4.17271706 12.3812411,4.09020764 C11.9600307,3.87960243 11.4478429,4.05033169 11.2372377,4.47154211 Z M12,16 C12.5522847,16 13,16.4477153 13,17 C13,17.5522847 12.5522847,18 12,18 C11.4477153,18 11,17.5522847 11,17 C11,16.4477153 11.4477153,16 12,16 Z M12,8 C12.5522847,8 13,8.44771525 13,9 L13,13 C13,13.5522847 12.5522847,14 12,14 C11.4477153,14 11,13.5522847 11,13 L11,9 C11,8.44771525 11.4477153,8 12,8 Z"/>
                    </svg>
                    <p>Don't close the window otherwise synchronization will be interrupted!</p>
                  </div>`
        );
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
