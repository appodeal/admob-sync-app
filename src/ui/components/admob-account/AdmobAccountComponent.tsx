import {AdMobAccount} from 'interfaces/appodeal.interfaces';
import {action, ActionTypes} from 'lib/actions';
import {sendToMain} from 'lib/common';
import {buttonClick, classNames} from 'lib/dom';
import React from 'react';
import style from './AdmobAccount.scss';


interface AdmobAccountComponentProps {
    account: AdMobAccount;
}


function onViewTutorial () {
    return sendToMain('accounts', action(ActionTypes.adMobSetupTutorial));
}

export function AdmobAccountComponent ({account}: AdmobAccountComponentProps) {
    return <div>
        {!account.reportsAvailable && <div className={style.setupRequired}>
            <h1>Setup required</h1>
            <p>Setup your project on Google developer console.</p>
            <div className={style.actions}>
                <button type="button" className={classNames('primary')} onClick={buttonClick(onViewTutorial)}>View tutorial</button>
                <button type="button">Done</button>
            </div>
        </div>}

    </div>;
}
