import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {action, ActionTypes} from 'lib/actions';
import {sendToMain} from 'lib/common';
import {buttonClick, classNames} from 'lib/dom';
import {LogFileInfo} from 'lib/sync-logs/logger';
import React from 'react';
import {LogListComponent} from 'ui/components/log-list/LogListComponent';
import style from './AdmobAccount.scss';


interface AdmobAccountComponentProps {
    account: AdMobAccount;
    logs: Array<LogFileInfo>;
}


function viewTutorial () {
    return sendToMain('accounts', action(ActionTypes.adMobSetupTutorial));
}

function runSync (this: AdMobAccount) {
    return sendToMain('sync', action(ActionTypes.runSync, this));
}

function openAdMob (this: AdMobAccount) {
    return sendToMain('accounts', action(ActionTypes.openAdmobPage, this));
}

export function AdmobAccountComponent ({account, logs}: AdmobAccountComponentProps) {
    return <div>
        {!account.reportsAvailable && <div className={style.setupRequired}>
            <h1>Setup required</h1>
            <p>Setup your project on Google developer console.</p>
            <div className={style.actions}>
                <button type="button" className={classNames('primary')} onClick={buttonClick(viewTutorial)}>View tutorial</button>
                <button type="button">Done</button>
            </div>
        </div>}

        <button type="button" onClick={buttonClick(runSync, account)}>Run Sync</button>
        <button type="button" onClick={buttonClick(openAdMob, account)}>Open Admob</button>
        <LogListComponent logs={logs || []} admobAccount={account}/>
    </div>;
}
