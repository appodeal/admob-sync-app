import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {AccountSetupState, SetupProgress} from 'core/store';
import {action, ActionTypes} from 'lib/actions';
import {sendToMain} from 'lib/messages';
import {messageDialog} from 'lib/window';
import React from 'react';
import {ProgressBar} from 'ui/components/progress-bar/ProgressBarComponent';
import style from './AdMobAccountSetup.scss';


interface AdMobAccountSetupProps {
    setupProgress: SetupProgress;
    setupState: AccountSetupState;
    account: AdMobAccount;
    appodealAccountId: string
}

export function AdMobAccountSetup ({setupProgress, setupState, account, appodealAccountId}: AdMobAccountSetupProps) {
    let {mode, visible} = setupState || {
            mode: null,
            visible: !account.isReadyForReports
        },
        formRef = React.createRef<HTMLFormElement>();
    return <>
        {(visible || !account.isReadyForReports) && <div className={style.setupRequired}>
            <h1>Setup required {account.isReadyForReports &&
            <button type="button" onClick={() => closeSetup(account)}>Cancel</button>}</h1>
            <section>
                {
                    (!!setupProgress && setupProgress.state !== 'error' || !setupProgress && mode === 'auto') && <>
                        <span>Progress: {setupProgress ? `${Math.round(setupProgress.percent)}%` : 'Initializing…'}</span>
                        <ProgressBar value={setupProgress ? setupProgress.percent : 0}
                                     status={setupProgress && setupProgress.state === 'progress' ? 'progress' : 'pending'}
                        />
                    </>
                }
                {
                    !!setupProgress && setupProgress.state === 'error' && <p>
                        <span className={style.errorMessage}>Auto setup was unsuccessful.&nbsp;</span>
                        <button type="button" onClick={() => autoSetup(account, appodealAccountId)}>Retry</button>
                    </p>
                }
                {
                    mode === null && !setupProgress && <>
                        <p>Setup your project on Google developer console.</p>
                        <div className={style.setupOptions}>
                            <button type="button" className={'primary'} onClick={() => autoSetup(account, appodealAccountId)}>Auto setup
                            </button>
                            <button type="button" onClick={() => manualSetup(account)}>Manual setup</button>
                        </div>

                    </>
                }
                {(mode === 'manual' || (setupProgress && setupProgress.state === 'error')) && <>
                    <p>Setup account manually according to this <a href="#" onClick={viewTutorial}>tutorial</a>.</p>
                    <form onSubmit={e => onFormSubmit(e, account, appodealAccountId)} onInput={() => onFormInput(formRef)} ref={formRef}>
                        <label htmlFor="clientId">Client ID:</label>
                        <input type="text" id="clientId" name="clientId"/>
                        <label htmlFor="clientSecret">Client Secret:</label>
                        <input type="text" id="clientSecret" name="clientSecret"/>
                        <div className="actions">
                            <button type="submit" name="saveBtn" disabled={true}>Save</button>
                            <button type="button" name="autoSetup" onClick={() => autoSetup(account, appodealAccountId)}>Auto setup</button>
                        </div>
                    </form>
                </>}
            </section>
        </div>}
    </>;
}

function closeSetup (adMobAccount: AdMobAccount) {
    sendToMain('accounts', action(ActionTypes.adMobSetupState, {
        adMobAccount,
        state: {
            visible: false,
            mode: null
        }
    }));
    sendToMain('accounts', action(ActionTypes.adMobCancelSetup, {
        adMobAccount
    }));
}

function autoSetup (adMobAccount: AdMobAccount, appodealAccountId: string) {
    sendToMain('accounts', action(ActionTypes.adMobSetupState, {
        adMobAccount,
        state: {
            visible: true,
            mode: 'auto'
        }
    }));
    sendToMain('accounts', action(ActionTypes.adMobSetupAccount, {
        appodealAccountId,
        adMobAccount
    }));

}

function manualSetup (adMobAccount: AdMobAccount) {
    sendToMain('accounts', action(ActionTypes.adMobSetupState, {
        adMobAccount,
        state: {
            visible: true,
            mode: 'manual'
        }
    }));
}

function onFormInput (formRef: React.RefObject<HTMLFormElement>) {
    if (formRef && formRef.current) {
        let formData = new FormData(formRef.current);
        (formRef.current.elements.namedItem('saveBtn') as HTMLButtonElement).disabled = !(formData.get('clientId') &&
            formData.get('clientSecret'));
    }
}

function onFormSubmit (event: React.SyntheticEvent<HTMLFormElement>, adMobAccount: AdMobAccount, appodealAccountId: string) {
    event.preventDefault();
    let formData = new FormData(event.target as HTMLFormElement);
    return sendToMain('accounts', action(ActionTypes.adMobSetCredentials, {
        appodealAccountId,
        credentialsInfo: {
            clientId: formData.get('clientId'),
            clientSecret: formData.get('clientSecret'),
            accountId: adMobAccount.id
        }
    })).catch(error => messageDialog(error.message))
}

function viewTutorial (event: React.MouseEvent) {
    event.preventDefault();
    sendToMain('accounts', action(ActionTypes.adMobSetupTutorial));
}
