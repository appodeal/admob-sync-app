import {ipcRenderer, remote} from 'electron';
import {AppodealAccountState} from 'interfaces/common.interfaces';
import {action, ActionTypes} from 'lib/actions';
import {classNames, singleEvent} from 'lib/dom';
import {sendToMain} from 'lib/messages';
import {messageDialog} from 'lib/window';
import React from 'react';
import style from './SignIn.scss';


interface SignInProps {
    account: AppodealAccountState;
}

export function SignIn ({account}: SignInProps) {
    return (<>
        <img className={classNames(style.logo)} src={require('ui/assets/images/logo-red.svg')} alt="Appodeal" draggable={false}/>
        <form onSubmit={singleEvent(e => onSubmit(e))}>
            <label htmlFor="email">Email:</label>
            <input type="email" name="email" id="email" defaultValue={account ? account.email : ''}/>
            <label htmlFor="password">Password:</label>
            <input type="password" name="password" id="password"/>
            <div className={classNames('actions')}>
                <button type="submit">Sign In</button>
                <button type="button" onClick={singleEvent(onCancel)}>Cancel</button>
            </div>
        </form>
    </>);
}


function onSubmit (event: Event) {
    event.preventDefault();
    let formData = new FormData(event.target as HTMLFormElement);
    return sendToMain('accounts', action(ActionTypes.appodealSignIn, {
        email: formData.get('email'),
        password: formData.get('password')
    }))
        .then(account => ipcRenderer.send('returnValue', account))
        .then(() => remote.getCurrentWindow().close())
        .catch(err => messageDialog(err.message));
}

function onCancel () {
    remote.getCurrentWindow().close();
}
