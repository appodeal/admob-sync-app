import React from 'react';
import {action, ActionTypes} from '../../../lib/actions';
import {singleEvent} from '../../../lib/dom';
import {sendToMain} from '../../../lib/messages';
import {confirmDialog} from '../../../lib/window';
import style from './ClearData.scss';


export function ClearData () {

    return (<div className={style.root}>
        <p>
            The app stores following info locally:
        </p>
        <ul>
            <li>Appodeal access token</li>
            <li>Cookies for admob accounts which you have signed in</li>
            <li>Sync history for each admob account</li>
            <li>Sync log files</li>
        </ul>
        <button type="button" onClick={singleEvent(confirmDeleteLocalData)}>Clear data</button>
    </div>);
}


function confirmDeleteLocalData () {
    confirmDialog(
        `Confirm your intention to delete the data! 
All the data will be immediately deleted,
all active syncs will be stopped,
you will immediately signed out.
App will be closed.
This action cannot be undone!`
    ).then((confirmed) => confirmed ? sendToMain('delete-data', action(ActionTypes.deleteAllAccountsData)) : null);
}
