import {AppState} from 'core/store';
import {remote} from 'electron';
import {classNames} from 'lib/dom';
import React from 'react';
import {OfflineComponent} from 'ui/components/offline/OfflineComponent';
import {UpdatesSettings} from 'ui/components/updates-settings/UpdatesSettingsComponent';
import {AccountsComponent} from '../accounts/AccountsComponent';
import style from './Root.scss';


export interface RootComponentProps {
    store: AppState
}

interface RootComponentState {
    tab: string;
}

export class RootComponent extends React.Component<RootComponentProps, RootComponentState> {
    private tabs = [
        {id: 'accounts', label: 'Accounts', isDisabled: () => this.props.store.outdatedVersion},
        {id: 'updates', label: 'Settings', isDisabled: () => false}
    ];

    constructor (props) {
        super(props);
        this.state = {
            tab: this.tabs[0].id
        };

        if (DEV_MODE) {
            this.tabs.push({id: 'development', label: 'Development', isDisabled: () => false});
        }
    }

    componentWillMount (): void {
        if (this.props.store.outdatedVersion) {
            this.selectTab('updates');
        }
    }

    componentDidUpdate (prevProps: Readonly<RootComponentProps>, prevState: Readonly<RootComponentState>, snapshot?: any): void {
        if (this.tabs.find(tab => tab.id === this.state.tab).isDisabled()) {
            this.selectTab(this.tabs.find(tab => !tab.isDisabled()).id);
        }
    }

    private selectTab (tabId) {
        this.setState({
            tab: tabId
        });
    }

    renderTabContent (tab: string) {
        switch (tab) {
        case 'accounts':
            return <AccountsComponent {...this.props.store}/>;
        case 'updates':
            return <UpdatesSettings {...this.props.store.preferences.updates}/>;
        case 'development':
            return <div className={style.scrollable}>
                <button type="button" onClick={() => remote.getCurrentWindow().webContents.toggleDevTools()}>Toggle DevTools</button>
                <pre>{JSON.stringify(environment, null, 4)}</pre>
            </div>;
        }
    }

    render () {
        if (!this.props.store.online) {
            return <OfflineComponent nextReconnect={this.props.store.nextReconnect}/>;
        }
        return (<>
            {this.props.store.outdatedVersion &&
            <div className={style.outdated}>App version is outdated! Please update it to be able to run sync!</div>}
            <section className={style.tabsContainer}>
                <div className={style.tabsBar}>
                    {this.tabs.map(tab => {
                        return <button type="button"
                                       key={tab.id}
                                       disabled={tab.isDisabled()}
                                       onClick={() => this.selectTab(tab.id)}
                                       className={classNames({[style.active]: tab.id === this.state.tab})}
                        >{tab.label}</button>;
                    })}
                </div>
                <div className={style.tabContent}>
                    {this.renderTabContent(this.state.tab)}
                </div>
            </section>
        </>);
    }
}
