import {AppodealAccount} from 'core/appdeal-api/interfaces/appodeal.account.interface';
import {MenuItemConstructorOptions, remote} from 'electron';
import {AppodealAccountState, UserAccount} from 'interfaces/common.interfaces';
import {action, ActionTypes} from 'lib/actions';
import {classNames, singleEvent} from 'lib/dom';
import {sendToMain} from 'lib/messages';
import {messageDialog} from 'lib/window';
import React from 'react';
import style from './AccountsChooser.scss';


interface AccountChooserProps {
    appodealAccounts: Array<AppodealAccountState>;
    selectedAccount: UserAccount;
    multipleAccountsSupport: boolean
}

export function AccountChooser ({appodealAccounts, selectedAccount, multipleAccountsSupport}: AccountChooserProps) {
    selectedAccount = selectedAccount || appodealAccounts[0];
    let accountToDisplay = selectedAccount ? appodealAccounts.find(acc => acc.id === selectedAccount.id) : null;
    return (<div className={classNames(style.accountChooser)}>
        <label>Appodeal account:</label>
        {
            !!appodealAccounts.length
                ? <>
                    {
                        !!multipleAccountsSupport
                            ? <select onMouseDown={e => onChooserClick(e, appodealAccounts)}>
                                <option>{accountToDisplay.email}</option>
                            </select>
                            : <span className={classNames(style.singleAccountName)}>{accountToDisplay.email}</span>
                    }
                    {
                        !accountToDisplay.active &&
                        <img src={require('ui/assets/images/account-warning.svg')} alt={''} title={'Resign-in is required'}/>
                    }
                </>
                : <button type="button" className={classNames('primary')} onClick={singleEvent(addAccount)}>{
                    multipleAccountsSupport
                        ? 'Add account'
                        : 'Sign In'
                }</button>
        }
        {
            !!appodealAccounts.length &&
            (
                multipleAccountsSupport
                    ? <button type="button" onClick={singleEvent(manageAccounts)}>Manage accounts</button>
                    : <>
                        {!appodealAccounts[0].active &&
                        <button type="button" onClick={singleEvent(() => reSignIn(appodealAccounts[0]))}>Sign in</button>}
                        {appodealAccounts[0].active &&
                        <button type="button" onClick={singleEvent(() => signOut(selectedAccount))}>Sign Out</button>}
                    </>
            )

        }
    </div>);
}

function onChooserClick (event: React.MouseEvent<HTMLSelectElement>, accounts: Array<AppodealAccountState>) {
    event.preventDefault();
    let targetRect = (event.target as HTMLSelectElement).getBoundingClientRect(),
        menu = remote.Menu.buildFromTemplate([
            ...accounts.map<MenuItemConstructorOptions>(acc => ({
                type: 'normal',
                label: acc.email,
                click: () => selectAccount(acc)
            })),
            {type: 'separator'},
            {type: 'normal', label: 'Add\u2026', click: () => addAccount()}
        ]);
    menu.popup({
        x: Math.round(targetRect.left),
        y: Math.round(targetRect.top)
    });
}

function selectAccount (account: AppodealAccountState) {
    return sendToMain('accounts', action(ActionTypes.selectAppodealAccount, {
        account
    }));
}

function addAccount () {
    return sendToMain<AppodealAccount>('accounts', action(ActionTypes.addAppodealAccount));
}

function reSignIn (account: AppodealAccountState) {
    return sendToMain<AppodealAccount>('accounts', action(ActionTypes.addAppodealAccount, {
        appodealAccount: account
    }));
}

function manageAccounts () {
    return sendToMain('accounts', action(ActionTypes.manageAppodealAccounts));
}

async function signOut (account: UserAccount) {
    let button = await messageDialog(
        `Confirm signing out from account "${account.email}".`,
        '',
        [
            {
                primary: true,
                label: 'Sign Out',
                action: () => sendToMain('accounts', action(ActionTypes.appodealSignOut, {
                    appodealAccountId: account.id
                }))
            },
            {
                cancel: true,
                label: 'Cancel',
                action: () => {}
            }
        ]
    );
    await button.action();
}

