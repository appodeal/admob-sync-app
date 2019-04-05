import {AppodealAccountState, UserAccount} from 'interfaces/common.interfaces';
import {action, ActionTypes} from 'lib/actions';
import {classNames, singleEvent} from 'lib/dom';
import {sendToMain} from 'lib/messages';
import React from 'react';
import style from './AppodealAccounts.scss';


interface AppodealAccountsProps {
    accounts: Array<AppodealAccountState>;
}

interface AppodealAccountsState {
    selectedAccount: AppodealAccountState;
}


export class AppodealAccounts extends React.Component<AppodealAccountsProps, AppodealAccountsState> {

    constructor (props) {
        super(props);
        this.state = {
            selectedAccount: null
        };
    }

    selectAccount (account: UserAccount) {
        this.setState({
            selectedAccount: account ? this.props.accounts.find(acc => acc.id === account.id) : null
        });
    }

    signOut (acc: AppodealAccountState) {
        return sendToMain<UserAccount>('accounts', action(ActionTypes.appodealSignOut, {
            appodealAccountId: acc.id
        })).then(account => this.selectAccount(account));
    }

    addAccount () {
        return sendToMain<UserAccount>('accounts', action(ActionTypes.addAppodealAccount))
            .then(account => this.selectAccount(account));
    }

    resignIn (acc: AppodealAccountState) {
        return sendToMain<UserAccount>('accounts', action(ActionTypes.addAppodealAccount, {
            appodealAccount: acc
        })).then(account => this.selectAccount(account));
    }

    render () {
        let {selectedAccount} = this.state;
        return (<div className={classNames(style.accountsList)}>
            <ul>
                {this.props.accounts.map(acc => {
                    return <li key={acc.id}
                               className={classNames({[style.active]: selectedAccount && acc.id === selectedAccount.id})}
                               onClick={() => this.selectAccount(acc)}
                    >
                        <span className={classNames(style.email)}>{acc.email}</span>
                        <span className={classNames(style.warning)} title="Resign in required">
                        {
                            !acc.active &&
                            <svg viewBox="0 0 16 16" width="16" height="16">
                                <polygon points="8,2 14,13 2,13"
                                         strokeWidth="4"
                                         stroke="var(--warning-color)"
                                         strokeLinejoin="round"
                                         fill="var(--warning-color)"
                                />
                                <circle cx="8" cy="12" r="1.5" fill="#000"/>
                                <path d="M7.5,9 l-1,-5 a 1.5 1.5 0 1 1 3 0 l-1,5 z" fill="#000"/>
                            </svg>
                        }
                    </span>
                    </li>;
                })}
            </ul>
            <div className={classNames(style.actions)}>
                <button type="button"
                        className={classNames('primary')}
                        onClick={singleEvent(() => this.addAccount())}
                >Add&hellip;
                </button>
                <button type="button"
                        disabled={!selectedAccount || selectedAccount.active}
                        onClick={singleEvent(() => this.resignIn(selectedAccount))}
                >Resign In
                </button>
                <button type="button"
                        disabled={!selectedAccount}
                        onClick={() => this.signOut(selectedAccount)}
                >Delete
                </button>
            </div>
        </div>);
    }

}
