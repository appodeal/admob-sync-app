import React from 'react';
import {ExtensionState} from '../../background/background';
import {getExtensionVersion} from '../../background/utils/minimal-version';
import logo from '../images/logo.svg';
import {onClickStartAdmobAccountSetup} from '../utils/popupClickHandlers';


import {AdmobAccountsList} from './AdmobAccountsList/AdmobAccountsList';
import {PreloaderIcon} from './preloader/PreloaderIcon';
import styles from './Popup.scss';


function SignInButton () {
    return (<div className={styles.flexCenter}><h1>Sign in to continue</h1>
        <div><a className="btn" target="_blank" href="https://www.appodeal.com/signin">Sign In</a></div>
    </div>);
}

function UpdateButton ({minimalVersion}) {
    return (<div className={styles.flexCenter}><h1>Update extension to continue</h1>
        <div><a className="btn" target="_blank" href="https://chrome.google.com/webstore/detail/appodeal/cnlfcihkilpkgdlnhjonhkfjjmbpbpbj">Update
            now</a></div>
        <br/>
        <div className={styles.center}><small>Current extension version has become outdated, minimal supported version
            is <b>{minimalVersion}</b>. To continue sync your accounts please update extension.</small></div>
    </div>);
}

function AdmobAccounts ({currentUser}) {
    return <div>
        <div>Appodeal Account: <b>{currentUser.email}</b></div>
        <hr className="top"/>
        {currentUser.accounts.length === 0 && <div className={styles.flexCenter}>
            <h1>Add your admob account</h1>
            <a className="btn" target="_blank" onClick={onClickStartAdmobAccountSetup}>Add Admob account</a>
        </div>}
        <AdmobAccountsList currentUser={currentUser}/>
    </div>;
}


function PopupContent ({currentUser, updateRequired, minimalVersion}) {
    if (updateRequired) {
        return <UpdateButton minimalVersion={minimalVersion}/>;
    }
    if (!currentUser) {
        return <SignInButton/>;
    }
    return <AdmobAccounts currentUser={currentUser}/>;
}


export function Popup ({state}: { state: ExtensionState }) {
    const {currentUser, isFetchingCurrentUser, updateRequired, minimalVersion} = state;

    if (isFetchingCurrentUser) {
        return <PreloaderIcon/>;
    }

    const showFooterAddButton = currentUser && currentUser.accounts.length > 0 && !updateRequired;

    return <>
        <header>
            <img src={logo}/>
        </header>
        <section className={styles.mainContent}>
            <PopupContent currentUser={currentUser} updateRequired={updateRequired} minimalVersion={minimalVersion}/>
            <hr className="bottom"/>
        </section>
        <footer className={showFooterAddButton ? '' : styles.onlyVersion}>
            {showFooterAddButton &&
            <a className={styles.addBtn} target="_blank" onClick={onClickStartAdmobAccountSetup}>Add another Admob account</a>}
            <small className={styles.version}>version {getExtensionVersion()}</small>
        </footer>
    </>;
}
