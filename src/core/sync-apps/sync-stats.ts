import {AppodealApp} from 'core/appdeal-api/interfaces/appodeal-app.interface';
import {Sync} from 'core/sync-apps/sync';
import {SyncRunner} from './sync-runner';


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
        created: new Map<string, AppInfo>(),
        updated: new Map<string, AppInfo>(),
        deleted: new Map<string, AppInfo>(),
        withErrors: new Map<string, AppInfo>()
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
        this.affectedApps.created.set(app.id, app);
    }

    appUpdated (app: AppodealApp) {
        if (this.affectedApps.created.has(app.id)) {
            return;
        }
        this.affectedApps.updated.set(app.id, app);
    }

    appDeleted (app: AppodealApp) {
        this.affectedApps.deleted.set(app.id, app);
    }

    errorWhileSync (app: AppodealApp) {
        this.affectedApps.withErrors.set(app.id, app);
    }

    toPlainObject (): SyncInfo {
        return {
            id: this.sync.id,
            runner: this.sync.runner,
            hasErrors: this.sync.hasErrors,
            affectedApps: {
                created: [...this.affectedApps.created.values()],
                updated: [...this.affectedApps.updated.values()],
                deleted: [...this.affectedApps.deleted.values()],
                withErrors: [...this.affectedApps.withErrors.values()]
            },
            startTs: this.startTs,
            endTs: this.endTs,
            terminated: this.terminated,
            partialSync: this.partialSync

        };
    }

}
