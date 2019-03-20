import {AppodealAccount} from 'core/appdeal-api/interfaces/appodeal.account.interface';
import {classNames, singleEvent} from 'lib/dom';
import React from 'react';
import style from './AppodealAccount.scss';


interface AppodealAccountProps {
    account: AppodealAccount;
    onSignIn: (credentials: { email: string, password: string, callback: Function }) => void;
    onSignOut: ({callback: Function}) => void;
}

export function AppodealAccountComponent ({account, onSignIn, onSignOut}: AppodealAccountProps) {
    let hasAccount = !!account.email,
        onSubmit = event => new Promise(resolve => {
            event.preventDefault();
            let form = event.target as HTMLFormElement,
                email = (form.elements.namedItem('login') as HTMLInputElement).value,
                password = (form.elements.namedItem('password') as HTMLInputElement).value;
            onSignIn({
                email,
                password,
                callback: () => resolve()
            });
        }),
        onSignOutClick = () => new Promise(resolve => {
            onSignOut({
                callback: () => resolve()
            });
        });
    return <form onSubmit={singleEvent(onSubmit)}>
        <label htmlFor="status">Status:</label>
        <output id="status"
                className={classNames(style.status, {[style.connected]: hasAccount, [style.disconnected]: !hasAccount})}
        >{hasAccount ? 'Connected' : 'Disconnected'}</output>
        <label htmlFor="login">Email:</label>
        {
            hasAccount ?
                <output id="login">{account.email}</output> :
                <input type="email" id="login" name="login"/>
        }
        {!hasAccount && <label htmlFor="password">Password:</label>}
        {!hasAccount && <input type="password" id="password" name="password"/>}
        <div className="actions">
            {
                hasAccount ?
                    <button type="button" onClick={singleEvent(onSignOutClick)}>Sign Out</button> :
                    <button type="submit">Sign In</button>
            }
        </div>
    </form>;
}
