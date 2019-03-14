import {AppodealAccount} from 'interfaces/appodeal.interfaces';
import {classNames} from 'lib/dom';
import React from 'react';
import style from './AppodealAccount.scss';


interface AppodealAccountProps {
    account: AppodealAccount;
    onSignIn: (credentials: { email: string, password: string }) => void;
    onSignOut: () => void;
}

export function AppodealAccountComponent ({account, onSignIn, onSignOut}: AppodealAccountProps) {
    let hasAccount = !!account.email,
        onSubmit = event => {
            event.preventDefault();
            let form = event.target as HTMLFormElement,
                email = (form.elements.namedItem('login') as HTMLInputElement).value,
                password = (form.elements.namedItem('password') as HTMLInputElement).value;
            onSignIn({
                email,
                password
            });
        };
    return <form onSubmit={onSubmit}>
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
                    <button type="button" onClick={onSignOut}>Sign Out</button> :
                    <button type="submit">Sign In</button>
            }
        </div>
    </form>;
}