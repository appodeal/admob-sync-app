import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {AppState} from 'core/store';
import {remote, shell} from 'electron';
import {action, ActionTypes} from 'lib/actions';
import {classNames, singleEvent} from 'lib/dom';
import {sendToMain} from 'lib/messages';
import {messageDialog} from 'lib/window';
import React from 'react';
import {AccountChooser} from 'ui/components/account-chooser/AccountChooserComponent';
import {AccountStatusComponent} from 'ui/components/account-status/AccountStatusComponent';
import {AdmobAccountComponent} from 'ui/components/admob-account/AdmobAccountComponent';
import style from './Accounts.scss';


type AccountsComponentProps = AppState;

const emailCollator = new Intl.Collator('en', {
    numeric: true,
    usage: 'sort',
    sensitivity: 'base',
    ignorePunctuation: true
});

export function AccountsComponent (
    {
        selectedAppodealAccount,
        selectedAccount: {account: selectedAccount},
        preferences: {accounts: {appodealAccounts}, multipleAccountsSupport},
        syncHistory,
        syncProgress,
        setupProgress,
        accountSetup
    }: AccountsComponentProps
) {
    let adMobAccounts = (selectedAppodealAccount ? selectedAppodealAccount.accounts : [])
        .sort((a, b) => emailCollator.compare(a.email, b.email));
    let appodealAccount = selectedAppodealAccount;
    return (
        <div className={style.accounts}>
            <div className={style.description}>
                <AccountChooser appodealAccounts={appodealAccounts}
                                selectedAccount={appodealAccount}
                                multipleAccountsSupport={multipleAccountsSupport}
                />
            </div>
            {
                !!appodealAccounts.length && appodealAccount
                    ? <>
                        <ul className={style.accountsList}>
                            {adMobAccounts.map(acc => {
                                return <li key={acc.email}
                                           onClick={singleEvent(() => selectAccount(acc))}
                                           className={classNames(
                                               style.adMobAccount,
                                               {[style.selected]: selectedAccount && selectedAccount.id === acc.id}
                                           )}
                                >
                                    <img srcSet={[
                                        `${require('ui/assets/images/admob-logo.png').x1.src} 1x`,
                                        `${require('ui/assets/images/admob-logo.png').x2.src} 2x`,
                                        `${require('ui/assets/images/admob-logo.png').x3.src} 3x`
                                    ].join(',')} alt=""
                                    />
                                    <span className={style.accountName}>{acc.email}</span>
                                    <span className={style.accountEmail}>
                                <AccountStatusComponent
                                    account={acc}
                                    historyInfo={syncHistory[acc.id]}
                                    syncProgress={syncProgress[acc.id]}
                                />
                                </span>
                                </li>;
                            })}

                        </ul>
                        <div className={style.accountControls}>
                            <button type="button"
                                    className={style.add}
                                    onClick={() => shell.openExternal('https://www.appodeal.com/apps/linked_networks#AddAdmobAccount')}
                                    disabled={!appodealAccount.email}
                            />
                        </div>
                        <div className={style.accountDetails}>
                            {
                                !!adMobAccounts.length
                                    ? (
                                        !!selectedAccount
                                            ? <AdmobAccountComponent account={selectedAccount}
                                                                     appodealAccountId={appodealAccount.id}
                                                                     historyInfo={syncHistory[selectedAccount.id]}
                                                                     syncProgress={syncProgress[selectedAccount.id]}
                                                                     setupProgress={setupProgress[selectedAccount.id]}
                                                                     setupState={accountSetup[selectedAccount.id] || {
                                                                         mode: null,
                                                                         visible: !selectedAccount.isReadyForReports
                                                                     }}
                                            />
                                            : <div className={classNames(style.noSelectedAccount)}>Choose account</div>
                                    )
                                    : <div className={classNames(style.noSelectedAccount)}>Add AdMob account</div>

                            }
                        </div>
                    </>
                    : <div className={classNames(style.accountsWarning)}>
                        {
                            multipleAccountsSupport
                                ? (appodealAccounts.length ? 'Sign in to Appodeal account' : 'Add at least one Appodeal account')
                                : 'Sign in to Appodeal account'
                        }
                    </div>
            }

        </div>
    );
}

function selectAccount (account: AdMobAccount) {
    return sendToMain('accounts', action(ActionTypes.selectAccount, {
        adMobAccount: account
    }));
}
/**
 * @deprecated
 */
function addAccount (appodealAccountId: string) {
    return sendToMain<{ newAccount: AdMobAccount, existingAccount: AdMobAccount }>(
        'accounts',
        action(ActionTypes.adMobAddAccount, {appodealAccountId})
    )
        .then(({existingAccount}) => {
            if (existingAccount) {
                setTimeout(() => messageDialog(`Following account already exists`, [
                    `Email: ${existingAccount.email}`,
                    `ID: ${existingAccount.id}`
                ].join('\n')));
            }
        })
        .then(() => {
            remote.getCurrentWindow().focus();
        })
        .catch(error => messageDialog(error.message));
}
