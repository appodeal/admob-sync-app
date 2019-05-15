import React from 'react';
import {action, ActionTypes} from '../../../lib/actions';
import {singleEvent} from '../../../lib/dom';
import {sendToMain} from '../../../lib/messages';
import style from './ClearData.scss';


export function ClearData () {

    return (<div className={style.root}>
        <p>
            The application stores the following data on your computer:
        </p>
        <ul>
            <li>Appodeal access token</li>
            <li>Cookies for your AdMob accounts</li>
            <li>Sync history for each AdMob account</li>
            <li>Sync log files</li>
        </ul>
        <p><img src={require('ui/assets/images/account-warning.svg')} alt={''} title={'Attention'}/> All data will be deleted immediately
            and irrevocably. You can not undo this action.</p>
        <p> You will be immediately signed out. The application will be closed.</p>
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
