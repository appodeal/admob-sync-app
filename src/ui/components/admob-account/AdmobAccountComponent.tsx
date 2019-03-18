import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {SyncProgress} from 'core/store';
import {SyncHistoryInfo} from 'core/sync-apps/sync-history';
import {action, ActionTypes} from 'lib/actions';
import {messageDialog, sendToMain} from 'lib/common';
import {getFormElement, singleEvent} from 'lib/dom';
import {LogFileInfo} from 'lib/sync-logs/logger';
import React, {Component} from 'react';
import {AccountStatusComponent} from 'ui/components/account-status/AccountStatusComponent';
import {LogListComponent} from 'ui/components/log-list/LogListComponent';
import style from './AdmobAccount.scss';


interface AdmobAccountComponentProps {
    account: AdMobAccount;
    syncProgress: SyncProgress;
    historyInfo: SyncHistoryInfo;
    logs: Array<LogFileInfo>;
}

interface AdmobAccountComponentState {
    saveAllowed: boolean;
    displaySetupForm: boolean;
}

export class AdmobAccountComponent extends Component<AdmobAccountComponentProps, AdmobAccountComponentState> {
    formRef: React.RefObject<HTMLFormElement>;

    constructor (props) {
        super(props);
        this.state = {
            saveAllowed: false,
            displaySetupForm: false
        };
        this.formRef = React.createRef<HTMLFormElement>();
    }

    componentWillReceiveProps (nextProps: Readonly<AdmobAccountComponentProps>) {
        if (this.formRef.current) {
            this.formRef.current.reset();
        }
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
        }))
            .then(() => this.displaySetupForm(this.props.account.isAdsenseApiActive))
            .catch(error => messageDialog(error.message));
    }

    private isSetupFormVisible (account: AdMobAccount): boolean {
        return this.state.displaySetupForm || !account.isAdsenseApiActive;
    }

    private displaySetupForm (value: boolean) {
        this.setState({
            displaySetupForm: value
        });
    }

    render () {
        let {account, logs} = this.props;
        return <>
            {this.isSetupFormVisible(account) && <div className={style.setupRequired} onInput={() => this.onFormInput()}>
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
                <button type="button"
                        onClick={singleEvent(this.runSync, this)}
                        className={'primary'}
                        disabled={!!this.props.syncProgress || this.props.historyInfo.admobAuthorizationRequired}
                >
                    Run Sync
                </button>
                <button type="button" onClick={singleEvent(this.openAdMob, this)}>Open Admob</button>
                {!this.isSetupFormVisible(account) &&
                <button type="button" onClick={() => this.displaySetupForm(true)}>Set credentials</button>}
            </div>
            {!!this.props.syncProgress &&
            <div className={style.syncProgress}>
                <AccountStatusComponent syncProgress={this.props.syncProgress} historyInfo={this.props.historyInfo}/>
            </div>
            }
            <LogListComponent logs={logs || []} admobAccount={account}/>
        </>;
    }
}
