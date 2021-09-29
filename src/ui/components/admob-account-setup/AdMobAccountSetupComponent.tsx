import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {AccountSetupState, SetupProgress} from 'core/store';
import {shell} from 'electron';
import {action, ActionTypes} from 'lib/actions';
import {sendToMain} from 'lib/messages';
import React from 'react';
import style from './AdMobAccountSetup.scss';


interface AdMobAccountSetupProps {
    setupProgress: SetupProgress;
    setupState: AccountSetupState;
    account: AdMobAccount;
    appodealAccountId: string
}

export function AdMobAccountSetup ({account}: AdMobAccountSetupProps) {
    const visible = !account.isReadyForReports;
    return <>
        {(visible || !account.isReadyForReports) && <div className={style.setupRequired}>
            <h1>
                Setup is required
            </h1>
            <section>
                <ol>
                    <li>Follow this
                        link <a
                            href="https://app.appodeal.com/apps/linked_networks#AddAdmobAccount"
                            onClick={(e) => {
                                e.preventDefault();
                                shell.openExternal('https://app.appodeal.com/apps/linked_networks#AddAdmobAccount');
                            }}
                        >https://app.appodeal.com/apps/linked_networks</a> or
                        click "Start setup"
                    </li>
                    <li>Grant requested permission for <b>{account.email}</b> account</li>
                    <li>Return to Sync App and click refresh button below</li>
                </ol>
                <div className={style.setupOptions}>
                    <button type="button"
                            className={'primary'}
                            onClick={() => shell.openExternal('https://app.appodeal.com/apps/linked_networks#AddAdmobAccount')}
                    >Start setup
                    </button>
                    <button type="button" onClick={() => refresh()}>Refresh</button>
                </div>
            </section>
        </div>}
    </>;
}

function refresh () {
    return sendToMain('accounts', action(ActionTypes.appodealFetchUsers));
}

