import {AppState} from 'core/store';
import {remote} from 'electron';
import {classNames} from 'lib/dom';
import React from 'react';
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
        {id: 'accounts', label: 'Accounts'},
        {id: 'updates', label: 'Updates'},
        {id: 'development', label: 'Development'}
    ];

    constructor (props) {
        super(props);
        this.state = {
            tab: this.tabs[0].id
        };
    }

    private setTab (tabId) {
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
            return <div>
                <button type="button" onClick={() => remote.getCurrentWindow().webContents.toggleDevTools()}>Toggle DevTools</button>
            </div>;
        }
    }

    render () {
        return (
            <section className={style.tabsContainer}>
                <div className={style.tabsBar}>
                    {this.tabs.map(tab => {
                        return <button type="button"
                                       key={tab.id}
                                       onClick={() => this.setTab(tab.id)}
                                       className={classNames({[style.active]: tab.id === this.state.tab})}
                        >{tab.label}</button>;
                    })}
                </div>
                <div className={style.tabContent}>
                    {this.renderTabContent(this.state.tab)}
                </div>
            </section>
        );
    }
}
