import {AppodealApp} from 'core/appdeal-api/interfaces/appodeal-app.interface';
import {Sync} from 'core/sync-apps/sync';
import {SyncRunner} from 'core/sync-apps/sync.service';


export type AppInfo = Pick<AppodealApp, 'id'> & Pick<AppodealApp, 'name'>;


export interface SyncInfo {
    readonly id: string;
    readonly startTs: number
    readonly endTs: number;
    readonly terminated: boolean;
    readonly hasErrors: boolean;
    // if only some apps where synced
    readonly partialSync: boolean;
    affectedApps: {
        created: AppInfo[];
        updated: AppInfo[];
        deleted: AppInfo[];
        withErrors: AppInfo[];
    },
    runner: SyncRunner;
    logSubmitted?: boolean;
}

export class SyncStats {

    public readonly affectedApps = {
        created: [],
        updated: [],
        deleted: [],
        withErrors: []
    };

    public id: string;

    constructor (private sync: Sync) {}

    public startTs: number;
    public endTs: number;

    public terminated = false;
    public partialSync = false;

    start () {
        this.startTs = Date.now();
    }

    end () {
        this.endTs = Date.now();
    }

    appCreated (app: AppodealApp) {
        this.affectedApps.created.push(app);
    }

    appUpdated (app: AppodealApp) {
        if (this.affectedApps.created.some(v => v.id === app.id)) {
            return;
        }
        this.affectedApps.updated.push(app);
    }

    appDeleted (app: AppodealApp) {
        this.affectedApps.deleted.push(app);
    }

    errorWhileSync (app: AppodealApp) {
        this.affectedApps.withErrors.push(app);
    }

    toPlainObject (): SyncInfo {
        return {
            id: this.sync.id,
            runner: this.sync.runner,
            hasErrors: this.sync.hasErrors,
            affectedApps: this.affectedApps,
            startTs: this.startTs,
            endTs: this.endTs,
            terminated: this.terminated,
            partialSync: this.partialSync

        };
    }

}
