import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {AccountSetupState, SetupProgress, SyncProgress} from 'core/store';
import {SyncHistoryInfo} from 'core/sync-apps/sync-history';
import {SyncEventsTypes} from 'core/sync-apps/sync.events';
import {action, ActionTypes} from 'lib/actions';
import {singleEvent} from 'lib/dom';
import {sendToMain} from 'lib/messages';
import {messageDialog} from 'lib/window';
import React, {Component} from 'react';
import {AccountStatusComponent} from 'ui/components/account-status/AccountStatusComponent';
import {AdMobAccountSetup} from 'ui/components/admob-account-setup/AdMobAccountSetupComponent';
import {LogListComponent} from 'ui/components/log-list/LogListComponent';
import {ProgressBar} from 'ui/components/progress-bar/ProgressBarComponent';
import style from './AdmobAccount.scss';


interface AdmobAccountComponentProps {
    appodealAccountId: string;
    account: AdMobAccount;
    syncProgress: SyncProgress;
    setupProgress: SetupProgress;
    setupState: AccountSetupState;
    historyInfo: SyncHistoryInfo;
}

interface AdmobAccountComponentState {

}

export class AdmobAccountComponent extends Component<AdmobAccountComponentProps, AdmobAccountComponentState> {

    constructor (props) {
        super(props);
        this.state = {};
    }

    get signedIn () {
        return !!this.props.historyInfo && !this.props.historyInfo.admobAuthorizationRequired;
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

    private isSetupFormVisible (): boolean {
        return this.props.setupState.visible || !this.props.account.isReadyForReports;
    }

    private displaySetupForm () {
        sendToMain('accounts', action(ActionTypes.adMobSetupState, {
            adMobAccount: this.props.account,
            state: {
                visible: true,
                mode: null
            }
        }));
    }

    private getProgressBarStatus ({lastEvent}: SyncProgress): 'progress' | 'pending' {
        if (lastEvent === SyncEventsTypes.CalculatingProgress || lastEvent === SyncEventsTypes.Started) {
            return 'pending';
        }
        return 'progress';
    }

    render () {
        let {account, setupProgress, setupState} = this.props;
        return <>
            <AdMobAccountSetup setupProgress={setupProgress}
                               account={account}
                               setupState={setupState}
                               appodealAccountId={this.props.appodealAccountId}
            />
            {account.isReadyForReports && <>
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

                        {!this.isSetupFormVisible() &&
                        <button type="button" onClick={() => this.displaySetupForm()}>Update credentials</button>}
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
                                  admobAccount={account}
                                  appodealAccountId={this.props.appodealAccountId}
                />
            </>}
        </>;
    }
}
