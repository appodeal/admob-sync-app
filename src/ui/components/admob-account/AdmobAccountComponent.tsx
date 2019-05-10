import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {SyncProgress} from 'core/store';
import {SyncHistoryInfo} from 'core/sync-apps/sync-history';
import {SyncEventsTypes} from 'core/sync-apps/sync.events';
import {action, ActionTypes} from 'lib/actions';
import {getFormElement, singleEvent} from 'lib/dom';
import {sendToMain} from 'lib/messages';
import {messageDialog} from 'lib/window';
import React, {Component} from 'react';
import {AccountStatusComponent} from 'ui/components/account-status/AccountStatusComponent';
import {LogListComponent} from 'ui/components/log-list/LogListComponent';
import {ProgressBar} from 'ui/components/progress-bar/ProgressBarComponent';
import style from './AdmobAccount.scss';


interface AdmobAccountComponentProps {
    appodealAccountId: string;
    account: AdMobAccount;
    syncProgress: SyncProgress;
    historyInfo: SyncHistoryInfo;
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

    get signedIn () {
        return !!this.props.historyInfo && !this.props.historyInfo.admobAuthorizationRequired;
    }

    componentWillReceiveProps (nextProps: Readonly<AdmobAccountComponentProps>) {
        if (this.formRef.current) {
            this.formRef.current.reset();
        }
        this.setState({
            displaySetupForm: !nextProps.account.isReadyForReports
        });
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
        return sendToMain('sync', action(ActionTypes.runSync, {
            appodealAccountId: this.props.appodealAccountId,
            adMobAccount: this.props.account
        }))
            .catch(err => messageDialog(err.message));
    }

    private openAdMob () {
        return sendToMain('accounts', action(ActionTypes.openAdmobPage, {
            adMobAccount: this.props.account
        }));
    }

    private signInAdMob () {
        return sendToMain('accounts', action(ActionTypes.adMobReSignIn, {
            appodealAccountId: this.props.appodealAccountId,
            adMobAccount: this.props.account
        })).catch(e => alert(e.message));
    }

    private setupDone (event: Event) {
        event.preventDefault();
        let form = event.target as HTMLFormElement,
            clientId = getFormElement(form, 'clientId').value.trim(),
            clientSecret = getFormElement(form, 'clientSecret').value.trim(),
            accountId = this.props.account.id;
        return sendToMain('accounts', action(ActionTypes.adMobSetCredentials, {
            appodealAccountId: this.props.appodealAccountId,
            credentialsInfo: {
                clientId,
                clientSecret,
                accountId
            }
        }))
            .then(() => this.displaySetupForm(this.props.account.isReadyForReports))
            .catch(error => messageDialog(error.message));
    }

    private isSetupFormVisible (account: AdMobAccount): boolean {
        return this.state.displaySetupForm || !account.isReadyForReports;
    }

    private displaySetupForm (value: boolean) {
        this.setState({
            displaySetupForm: value
        });
    }

    private getProgressBarStatus ({lastEvent}: SyncProgress): 'progress' | 'pending' {
        if (lastEvent === SyncEventsTypes.CalculatingProgress || lastEvent === SyncEventsTypes.Started) {
            return 'pending';
        }
        return 'progress';
    }

    render () {
        let {account} = this.props;
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
                {this.signedIn && <>
                    {
                        //  make public when open admob safe browsing admob is implemented
                        environment.development &&
                        <div style={{marginBottom: '10px'}}>
                            <button type="button" onClick={singleEvent(this.openAdMob, this)}>Open Admob (For developers only)</button>
                        </div>
                    }
                    <button type="button"
                            onClick={singleEvent(this.runSync, this)}
                            className={'primary'}
                            disabled={!!this.props.syncProgress || this.props.historyInfo.admobAuthorizationRequired}
                    >
                        Run Sync
                    </button>

                    {!this.isSetupFormVisible(account) &&
                    <button type="button" onClick={() => this.displaySetupForm(true)}>Update credentials</button>}
                </>}
                {!this.signedIn && <>
                    <button onClick={singleEvent(this.signInAdMob, this)}
                            className={'primary'}
                    >Sign In
                    </button>
                </>}
            </div>

            {!!this.props.syncProgress &&
            <div className={style.syncProgress}>
                <AccountStatusComponent syncProgress={this.props.syncProgress} historyInfo={this.props.historyInfo}/>
                <ProgressBar value={this.props.syncProgress.percent} status={this.getProgressBarStatus(this.props.syncProgress)}/>
            </div>
            }
            <LogListComponent historyInfo={this.props.historyInfo}
                              activeSyncId={this.props.syncProgress ? this.props.syncProgress.id : null}
                              admobAccount={account}
                              appodealAccountId={this.props.appodealAccountId}
            />
        </>;
    }
}
