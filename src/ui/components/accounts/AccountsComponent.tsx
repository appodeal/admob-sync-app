import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {AppodealAccount} from 'core/appdeal-api/interfaces/appodeal.account.interface';
import {AppState} from 'core/store';
import {remote} from 'electron';
import {action, ActionTypes} from 'lib/actions';
import {messageDialog, sendToMain} from 'lib/common';
import {classNames, singleEvent} from 'lib/dom';
import {LogFileInfo} from 'lib/sync-logs/logger';
import React from 'react';
import {AccountStatusComponent} from 'ui/components/account-status/AccountStatusComponent';
import {AdmobAccountComponent} from 'ui/components/admob-account/AdmobAccountComponent';
import {AppodealAccountComponent} from 'ui/components/appodeal-account/AppodealAccountComponent';
import style from './Accounts.scss';


type AccountsComponentProps = AppState;

interface AccountsComponentState {
    selectedAccount: AppodealAccount | AdMobAccount;
    accountLogs: LogFileInfo[];
}

export class AccountsComponent extends React.Component<AccountsComponentProps, AccountsComponentState> {

    constructor (props) {
        super(props);
        this.state = {
            selectedAccount: this.props.appodealAccount,
            accountLogs: []
        };
    }

    componentWillReceiveProps (nextProps: Readonly<AccountsComponentProps>) {
        let accountToSelect = nextProps.appodealAccount.accounts.find(acc => acc.id === this.state.selectedAccount.id);
        if (accountToSelect) {
            this.selectAccount(accountToSelect);
        }
    }

    private selectAccount (account: AppodealAccount | AdMobAccount) {
        this.setState({
            selectedAccount: account
        });
        if (account !== this.props.appodealAccount) {
            sendToMain('accounts', action(ActionTypes.selectAdmobAccount, account))
                .then((logs: LogFileInfo[]) => this.setState({accountLogs: logs}));
        }
    }

    private updateSelectedAccount (account: AdMobAccount) {
        if (account) {
            let adMobAccount = this.props.appodealAccount.accounts.find(acc => acc.id === account.id);
            if (adMobAccount) {
                this.selectAccount(adMobAccount);
            }
        }
    }

    onSignIn ({email, password}: { email: string, password: string }) {
        return sendToMain('accounts', action(ActionTypes.appodealSignIn, {email, password}))
            .then(() => this.selectAccount(this.props.appodealAccount))
            .catch(err => messageDialog(err.message));
    }

    onSignOut () {
        return sendToMain('accounts', action(ActionTypes.appodealSignOut))
            .then(() => this.selectAccount(this.props.appodealAccount));
    }

    onAddAccount () {
        return sendToMain<{ newAccount: AdMobAccount, existingAccount: AdMobAccount }>('accounts', action(ActionTypes.adMobAddAccount))
            .then(({newAccount, existingAccount}) => {
                this.updateSelectedAccount(newAccount || existingAccount);
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

    renderAccountForm () {
        let appodealAccount = this.props.appodealAccount;
        if (this.state.selectedAccount.id === appodealAccount.id) {
            return <AppodealAccountComponent account={appodealAccount}
                                             onSignIn={cred => this.onSignIn(cred)}
                                             onSignOut={() => this.onSignOut()}
            />;
        } else {
            return <AdmobAccountComponent account={this.state.selectedAccount as AdMobAccount}
                                          historyInfo={this.props.syncHistory[this.state.selectedAccount.id]}
                                          syncProgress={this.props.syncProgress[this.state.selectedAccount.id]}
                                          logs={this.state.accountLogs}
            />;
        }
    }

    render () {
        let {selectedAccount} = this.state,
            {appodealAccount} = this.props,
            {accounts} = appodealAccount;
        return (
            <div className={style.accounts}>
                <div className={style.description}>Manage your accounts and bla bla bla...</div>
                <ul className={style.accountsList}>
                    <li onClick={() => this.selectAccount(appodealAccount)}
                        className={classNames({[style.selected]: selectedAccount.id === appodealAccount.id})}
                    >
                        <img srcSet={[
                            `${require('ui/assets/images/appodeal-logo.png').x1.src} 1x`,
                            `${require('ui/assets/images/appodeal-logo.png').x2.src} 2x`,
                            `${require('ui/assets/images/appodeal-logo.png').x3.src} 3x`
                        ].join(',')} alt=""/>
                        <span className={style.accountName}>Appodeal</span>
                        <span className={style.accountEmail}>{appodealAccount.email}</span>
                    </li>
                    {!!accounts.length && <li className={style.hr}/>}
                    {accounts.map(acc => {
                        return <li key={acc.email}
                                   onClick={() => this.selectAccount(acc)}
                                   className={classNames(style.adMobAccount, {[style.selected]: selectedAccount.id === acc.id})}
                        >
                            <img srcSet={[
                                `${require('ui/assets/images/admob-logo.png').x1.src} 1x`,
                                `${require('ui/assets/images/admob-logo.png').x2.src} 2x`,
                                `${require('ui/assets/images/admob-logo.png').x3.src} 3x`
                            ].join(',')} alt=""/>
                            <span className={style.accountName}>{acc.email}</span>
                            <span className={style.accountEmail}>
                                <AccountStatusComponent historyInfo={this.props.syncHistory[acc.id]}
                                                        syncProgress={this.props.syncProgress[acc.id]}
                                />
                                </span>
                        </li>;
                    })}

                </ul>
                <div className={style.accountControls}>
                    <button type="button"
                            className={style.add}
                            onClick={singleEvent(this.onAddAccount, this)}
                            disabled={!appodealAccount.email}
                    />
                </div>
                <div className={style.accountDetails}>
                    {this.renderAccountForm()}
                </div>
            </div>
        );
    }
}
