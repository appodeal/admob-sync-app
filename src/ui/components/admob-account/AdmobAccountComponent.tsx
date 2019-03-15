import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {action, ActionTypes} from 'lib/actions';
import {sendToMain} from 'lib/common';
import {getFormElement, singleEvent} from 'lib/dom';
import {LogFileInfo} from 'lib/sync-logs/logger';
import React, {Component} from 'react';
import {LogListComponent} from 'ui/components/log-list/LogListComponent';
import style from './AdmobAccount.scss';


interface AdmobAccountComponentProps {
    account: AdMobAccount;
    logs: Array<LogFileInfo>;
}


export class AdmobAccountComponent extends Component<AdmobAccountComponentProps, { saveAllowed: boolean }> {
    formRef: React.RefObject<HTMLFormElement>;

    constructor (props) {
        super(props);
        this.state = {
            saveAllowed: false
        };
        this.formRef = React.createRef<HTMLFormElement>();
    }

    private onFormInput () {
        this.setState({
            saveAllowed: this.isSaveAllowed(this.formRef.current)
        });
    }

    private isSaveAllowed (form: HTMLFormElement): boolean {
        if (!form) {
            return false;
        }
        let clientId = getFormElement(form, 'clientId').value.trim(),
            clientSecret = getFormElement(form, 'clientSecret').value.trim();
        return !!(clientId && clientSecret);
    }

    private viewTutorial () {
        return sendToMain('accounts', action(ActionTypes.adMobSetupTutorial));
    }

    private runSync () {
        return sendToMain('sync', action(ActionTypes.runSync, this.props.account));
    }

    private openAdMob () {
        return sendToMain('accounts', action(ActionTypes.openAdmobPage, this.props.account));
    }

    private setupDone (event: Event) {
        event.preventDefault();
        let form = event.target as HTMLFormElement,
            clientId = getFormElement(form, 'clientId').value.trim(),
            clientSecret = getFormElement(form, 'clientSecret').value.trim(),
            accountId = this.props.account.id;
        return sendToMain('accounts', action(ActionTypes.adMobSetCredentials, {
            clientId,
            clientSecret,
            accountId
        }));
    }

    render () {
        let {account, logs} = this.props;
        return <>
            {!account.isAdsenseApiActive && <div className={style.setupRequired} onInput={() => this.onFormInput()}>
                <h1>Setup required</h1>
                <p>Setup your project on Google developer console.</p>
                <form onSubmit={singleEvent(this.setupDone, this)} ref={this.formRef}>
                    <label htmlFor="clientId">Client ID:</label>
                    <input type="text" id="clientId" name="clientId"/>
                    <label htmlFor="clientSecret">Client Secret:</label>
                    <input type="text" id="clientSecret" name="clientSecret"/>
                    <div className="actions">
                        <button type="submit" disabled={!this.state.saveAllowed}>Save</button>
                        <button type="button" onClick={singleEvent(this.viewTutorial, this)}>View tutorial</button>
                    </div>
                </form>
            </div>}
            <div>
                <button type="button" onClick={singleEvent(this.runSync, this)}>Run Sync</button>
                <button type="button" onClick={singleEvent(this.openAdMob, this)}>Open Admob</button>
            </div>
            <LogListComponent logs={logs || []} admobAccount={account}/>
        </>;
    }
}
