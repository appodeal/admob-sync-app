import React from 'react';
import {action, ActionTypes} from '../../../lib/actions';
import {singleEvent} from '../../../lib/dom';
import {sendToMain} from '../../../lib/messages';
import style from './ClearData.scss';


export function ClearData () {

    return (<div className={style.root}>
        <p>
            The app stores the following info locally:
        </p>
        <ul>
            <li>Appodeal access token</li>
            <li>Cookies for Admob accounts which you have signed in</li>
            <li>Sync history for each Admob account</li>
            <li>Sync log files</li>
        </ul>
        <p>&nbsp;</p>
        <p><img src={require('ui/assets/images/account-warning.svg')} alt={''} title={'Attention'}/> All data will be immediately deleted.
            You will immediately signed out. App will be closed. You cannot revert this action.</p>
        <button type="button" className={'primary'} onClick={singleEvent(closeWindow)}>Cancel</button>
        <button type="button" onClick={singleEvent(confirmDeleteLocalData)}>Clear data</button>
    </div>);
}


function confirmDeleteLocalData () {
    return sendToMain('delete-data', action(ActionTypes.deleteAllAccountsData));
}

function closeWindow () {
    return sendToMain('delete-data', action(ActionTypes.hideDeleteAllAccountsDataDialog));
}
