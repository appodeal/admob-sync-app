import {AppodealAccount} from 'core/appdeal-api/interfaces/appodeal.account.interface';
import React from 'react';
import admobLogo from 'ui/assets/images/admob-logo.svg';
import {onClickStartAdmobAccountSetup, onClickStartSyncAdmobAccount} from '../../utils/popupClickHandlers';
import styles from './AdmobAccountsList.scss';


export function AdmobAccountsList ({currentUser}: { currentUser: AppodealAccount }) {

    function renderAccount (account) {
        return (<li key={account.email}>
            <span>
                <img src={admobLogo} alt={""}/><span className={styles.email}>{account.email}</span>
            </span>
            {account.isReadyForReports &&
            <button className={`btn ${styles.slimBtn}`} onClick={onClickStartSyncAdmobAccount}>Sync</button>}
            {!account.isReadyForReports &&
            <button className={`btn ${styles.slimBtn}`} onClick={onClickStartAdmobAccountSetup}>Enable reporting</button>}
        </li>);
    }

    return <ul>{currentUser.accounts.map(renderAccount)}</ul>;
}
