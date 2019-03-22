import {BrowserWindow, ipcRenderer, remote} from 'electron';
import {classNames} from 'lib/dom';
import {isMacOS} from 'lib/platform';
import React from 'react';
import style from './WindowsControls.scss';
import Timeout = NodeJS.Timeout;


export interface WindowsControlsProps {
    currentWindow: BrowserWindow
}

export class WindowsControlsComponent extends React.Component<WindowsControlsProps, { maximized: boolean }> {
    onClose: () => void;
    onMinimize: () => void;
    onMaximize: () => void;
    onWindowMaximized: () => void;
    onWindowUnMaximized: () => void;
    onWindowResize: () => void;
    resizeDelay: Timeout;

    constructor (props: WindowsControlsProps) {
        super(props);
        this.state = {
            maximized: this.props.currentWindow.isMaximized()
        };
        this.onClose = () => this.sendWindowCommand('close');
        this.onMinimize = () => this.sendWindowCommand('minimize');
        this.onMaximize = () => this.sendWindowCommand(this.state.maximized ? 'unmaximize' : 'maximize');
        this.onWindowMaximized = () => this.setMaximized(true);
        this.onWindowUnMaximized = () => this.setMaximized(false);
        this.onWindowResize = () => {
            clearTimeout(this.resizeDelay);
            this.resizeDelay = setTimeout(() => this.setMaximized(remote.getCurrentWindow().isMaximized()), 100);
        };
    }

    private setMaximized (maximized: boolean) {
        this.setState({maximized});
    }

    private sendWindowCommand (command: 'minimize' | 'maximize' | 'unmaximize' | 'close') {
        ipcRenderer.send('windowControl', command);
    }

    componentDidMount () {
        this.props.currentWindow.on('maximize', this.onWindowMaximized);
        this.props.currentWindow.on('unmaximize', this.onWindowUnMaximized);
        this.props.currentWindow.on('resize', this.onWindowResize);
    }

    componentWillUnmount () {
        this.props.currentWindow.removeListener('maximize', this.onWindowMaximized);
        this.props.currentWindow.removeListener('unmaximize', this.onWindowUnMaximized);
        this.props.currentWindow.removeListener('resize', this.onWindowResize);
    }

    render () {
        return (
            <div className={classNames(style.windowsControls)} style={{'display': !isMacOS() ? 'flex' : 'none'}}>
                {
                    this.props.currentWindow.isMinimizable() &&
                    <button type="button" className={classNames(style.minimize)} onClick={this.onMinimize}>
                        <svg xmlns="http://www.w3.org/2000/svg"
                             viewBox="0 0 10 10"
                             width="10"
                             height="10"
                             preserveAspectRatio="xMidYMid meet"
                             vectorEffect="non-scaling-stroke"
                        >
                            <line x1="0" y1="50%" x2="100%" y2="50%" strokeWidth="1"/>
                        </svg>
                    </button>
                }
                {
                    this.props.currentWindow.isMaximizable() &&
                    <button type="button" className={classNames(style.maximize)} onClick={this.onMaximize}>
                        {
                            this.state.maximized
                                ?
                                <svg xmlns="http://www.w3.org/2000/svg"
                                     viewBox="0 0 10 10"
                                     width="10"
                                     height="10"
                                     preserveAspectRatio="xMidYMid meet"
                                     vectorEffect="non-scaling-stroke"
                                >
                                    <polyline points="0,3 0,10 7,10" strokeWidth="2" fill="transparent"/>
                                    <polyline points="0,3 7,3 7,10" strokeWidth="1" fill="transparent"/>
                                    <polyline points="3,0 10,0 10,7" strokeWidth="2" fill="transparent"/>
                                    <line x1="3" y1="0" x2="3" y2="3" strokeWidth="1"/>
                                    <line x1="7" y1="7" x2="10" y2="7" strokeWidth="1"/>
                                </svg>
                                :
                                <svg xmlns="http://www.w3.org/2000/svg"
                                     viewBox="0 0 10 10"
                                     width="10"
                                     height="10"
                                     preserveAspectRatio="xMidYMid meet"
                                     vectorEffect="non-scaling-stroke"
                                >
                                    <polygon points="0,0 10,0 10,10 0,10" strokeWidth="2" fill="transparent"/>
                                </svg>
                        }
                    </button>
                }
                {
                    this.props.currentWindow.isClosable() &&
                    <button type="button" className={classNames(style.close)} onClick={this.onClose}>
                        <svg xmlns="http://www.w3.org/2000/svg"
                             viewBox="0 0 10 10"
                             width="10"
                             height="10"
                             preserveAspectRatio="xMidYMid meet"
                             vectorEffect="non-scaling-stroke"
                        >
                            <line x1="0" y1="0" x2="10" y2="10" strokeWidth="1"/>
                            <line x1="10" y1="0" x2="0" y2="10" strokeWidth="1"/>
                        </svg>
                    </button>
                }
            </div>
        );
    }

}
