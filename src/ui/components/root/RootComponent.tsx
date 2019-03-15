import {classNames} from 'lib/dom';
import React from 'React';
import {AccountsComponent} from '../accounts/AccountsComponent';
import style from './Root.scss';


export interface RootComponentProps {
    store: any
}

interface RootComponentState {
    tab: string;
}

export class RootComponent extends React.Component<RootComponentProps, RootComponentState> {
    private tabs = [
        {id: 'accounts', label: 'Accounts'},
        {id: 'appearance', label: 'Appearance'},
        {id: 'notifications', label: 'Notifications'}
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
            return <AccountsComponent appodealAccount={this.props.store.appodealAccount}/>;
        case 'appearance':
            return <div>Appearance</div>;
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
