import {action, ActionTypes} from 'lib/actions';
import {sendToMain} from 'lib/messages';

import * as React from 'react';
import style from './Offline.scss';


export class OfflineComponent extends React.Component<{
    nextReconnect: number;
}, {
    secondsAgo: number;
    reconnecting: boolean;
}> {

    updateTimer;

    constructor (props) {
        super(props);
        this.state = {
            secondsAgo: 0,
            reconnecting: false
        };
    }

    componentWillMount (): void {
        this.updateTimer = setInterval(() => this.updateState(), 500);
    }

    updateState (reconnectValue?) {
        const secondsAgo = Math.max(0, Math.round((this.props.nextReconnect - Date.now()) / 1000));
        this.setState({
            secondsAgo: secondsAgo,
            reconnecting: reconnectValue === undefined ? this.state.reconnecting : reconnectValue
        });
    }

    componentWillUnmount (): void {
        clearInterval(this.updateTimer);
    }

    onClickTryNow () {
        this.updateState(true);
        sendToMain('online', action(ActionTypes.appodealPing))
            .then(
                () => this.updateState(false),
                () => this.updateState(false)
            );
    };

    render () {
        return <div className={style.content}>
            <div>
                <p>You seem to be offline. Appodeal is trying to connect...</p>
                <p>{!this.state.secondsAgo || this.state.reconnecting ?
                    'Reconnecting...' :
                    `Next attempt in ${this.state.secondsAgo} seconds...`}
                </p>
                <div className={style.buttons}>
                    <button className="primary" onClick={() => this.onClickTryNow()}>Try now</button>
                </div>
            </div>
        </div>;
    }
}
