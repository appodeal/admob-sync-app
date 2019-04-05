import {Notification, shell} from 'electron';
import {EventEmitter} from 'events';
import {getAppVersion} from 'lib/about';
import {AppPreferences} from 'lib/app-preferences';
import {nodeFetch} from 'lib/fetch';
import {getOsName} from 'lib/platform';
import {URLS} from 'lib/urls';
import {messageDialog} from 'lib/window';
import Timeout = NodeJS.Timeout;


export interface DistInfo {
    version: string;
    fileName: string;
}

class Dist implements DistInfo {
    version: string;
    fileName: string;

    constructor ({version, fileName}: DistInfo) {
        this.version = version;
        this.fileName = fileName;
    }

    download () {
        shell.openExternal(`${URLS.updates}/${this.fileName}`);
    }

    viewReleaseNotes () {
        shell.openExternal(`${URLS.releaseNotes}/`);
    }

    async notify () {
        let notification = new Notification({
            title: 'AdMob Sync updates available',
            body: `New version ${this.version} is available to download.`
        });
        notification.once('click', () => {
            notification.close();
            this.showUpdateDialog();
        });
        notification.show();

    }

    async showUpdateDialog () {
        let currentVersion = getAppVersion(),
            userChoice = await messageDialog('Updates available', [
                `Current version: ${currentVersion}`,
                `New version: ${this.version}`
            ].join('\n'), [
                {label: 'Cancel', action: () => {}, cancel: true},
                {label: 'View release notes', action: () => this.viewReleaseNotes()},
                {label: 'Download', action: () => this.download(), primary: true}
            ]);
        userChoice.action();
    }
}

export enum UpdatePeriod {
    manual = 0,
    custom = 1,
    daily = 86400000,
    weekly = 604800000,
    monthly = 2592000000
}

export enum TimePeriod {
    hour = 3600000,
    day = 86400000,
    week = 604800000,
    month = 18144000000
}

export class UpdatesService extends EventEmitter {

    private scheduleInterval: Timeout;
    private lastCheck: Date;
    availableDist: Dist = null;

    constructor (lastCheck: string) {
        super();
        this.lastCheck = new Date(lastCheck);
    }

    private async fetchDistInfo (): Promise<DistInfo> {
        let response = await nodeFetch<{ [key: string]: DistInfo }>(`${URLS.updates}/dist-info.json`, {
                headers: {
                    'cache-control': 'no-cache'
                }
            }).then(r => r.json()),
            osName = getOsName();
        this.lastCheck = new Date();
        return response && response[osName] || null;
    }

    async check (): Promise<boolean> {
        let distInfo = await this.fetchDistInfo(),
            currentVersion = getAppVersion();
        if (distInfo && currentVersion !== distInfo.version) {
            this.availableDist = new Dist(distInfo);
            return true;
        }
        return false;
    }

    showNoUpdatesDialog () {
        messageDialog('You are already up to date');
    }

    schedule (period: UpdatePeriod, {value, interval}: AppPreferences['updates']['customOptions']) {
        if (this.scheduleInterval) {
            clearInterval(this.scheduleInterval);
        }
        if (period !== UpdatePeriod.manual) {
            let time = UpdatePeriod.custom ? Math.round(value * interval) : period;
            if (time < TimePeriod.hour) {
                time = TimePeriod.hour;
            }
            this.scheduleInterval = setInterval(() => {
                if (Date.now() - this.lastCheck.getTime() <= time) {
                    this.emit('check');
                }
            }, TimePeriod.hour) as unknown as Timeout;
        }
    }


}




