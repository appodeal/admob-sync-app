import {Actions} from '../common/actions';


chrome.runtime.sendMessage({type: Actions.updateAdmobAccountCredentialsOAuthCallbackVisited});

setTimeout(() => {
    console.log(`redirect to nice UI that we are finished adding account`);
    document.location.href = '/admob_api/success_page';
});
