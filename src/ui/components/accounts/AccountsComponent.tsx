import {remote} from 'electron';
import {AdMobAccount, AppodealAccount} from 'interfaces/appodeal.interfaces';
import {UserAccount} from 'interfaces/common.interfaces';
import {action, ActionTypes} from 'lib/actions';
import {sendToMain} from 'lib/common';
import {buttonClick, classNames} from 'lib/dom';
import React from 'react';
import {AdmobAccountComponent} from 'ui/components/admob-account/AdmobAccountComponent';
import {AppodealAccountComponent} from 'ui/components/appodeal-account/AppodealAccountComponent';
import style from './Accounts.scss';


export interface AccountsComponentProps {
    appodealAccount: AppodealAccount
    adMobAccounts: Array<AdMobAccount>
}

interface AccountsComponentState {
    selectedAccount: UserAccount;
}

export class AccountsComponent extends React.Component<AccountsComponentProps, AccountsComponentState> {

    constructor (props) {
        super(props);
        this.state = {
            selectedAccount: this.props.appodealAccount
        };
    }

    private selectAccount (account: UserAccount) {
        this.setState({
            selectedAccount: account
        });
    }

    private updateSelectedAccount (account: UserAccount) {
        if (account) {
            let adMobAccount = this.props.adMobAccounts.find(acc => acc.email === account.email);
            if (adMobAccount) {
                this.selectAccount(adMobAccount);
            } else if (account.email === this.props.appodealAccount.email) {
                this.selectAccount(this.props.appodealAccount);
            }
        }
    }

    onSignIn ({email, password}: { email: string, password: string }) {
        sendToMain('accounts', action(ActionTypes.appodealSignIn, {email, password}))
            .then(account => this.updateSelectedAccount(account as UserAccount))
            .catch(err => {
                alert(err.message);
            });
    }

    onSignOut () {
        sendToMain('accounts', action(ActionTypes.appodealSignOut))
            .then(account => this.updateSelectedAccount(account as UserAccount));
    }

    onAddAccount () {
        return sendToMain('accounts', action(ActionTypes.adMobAddAccount))
            .then(account => this.updateSelectedAccount(account as UserAccount))
            .then(() => {
                remote.getCurrentWindow().focus();
            });
    }

    onRemoveAccount (account: UserAccount) {
        sendToMain('accounts', action(ActionTypes.adMobRemoveAccount, {account}));
    }

    renderAccountForm () {
        let appodealAccount = this.props.appodealAccount;
        if (this.state.selectedAccount === appodealAccount) {
            return <AppodealAccountComponent account={appodealAccount}
                                             onSignIn={cred => this.onSignIn(cred)}
                                             onSignOut={() => this.onSignOut()}
            />;
        } else {
            return <AdmobAccountComponent account={this.state.selectedAccount as AdMobAccount}/>;
        }
    }

    render () {
        return (
            <div className={style.accounts}>
                <div className={style.description}>Manage your accounts and bla bla bla...</div>
                <ul className={style.accountsList}>
                    <li onClick={() => this.selectAccount(this.props.appodealAccount)}
                        className={classNames({[style.selected]: this.state.selectedAccount === this.props.appodealAccount})}
                    >
                        <img src="" alt=""/>
                        <span className={style.accountName}>Appodeal</span>
                        <span className={style.accountEmail}>{this.props.appodealAccount.email}</span>
                    </li>
                    {!!this.props.adMobAccounts.length && <li className={style.hr}></li>}
                    {this.props.adMobAccounts.map(acc => {
                        return <li key={acc.email}
                                   onClick={() => this.selectAccount(acc)}
                                   className={classNames({[style.selected]: this.state.selectedAccount === acc})}
                        >
                            <img src="" alt=""/>
                            <span className={style.accountName}>Admob</span>
                            <span className={style.accountEmail}>{acc.email}</span>
                        </li>;
                    })}

                </ul>
                <div className={style.accountControls}>
                    <button type="button" className={style.add} onClick={buttonClick(this.onAddAccount, this)}></button>
                    <button type="button"
                            disabled={this.state.selectedAccount === this.props.appodealAccount}
                            onClick={() => this.onRemoveAccount(this.state.selectedAccount)}
                    ></button>
                </div>
                <div className={style.accountDetails}>
                    {this.renderAccountForm()}
                </div>
            </div>
        );
    }
}
