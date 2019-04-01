import {getAppVersion} from 'lib/about';
import {getJsonFile, saveJsonFile} from 'lib/json-storage';
import {TimePeriod, UpdatePeriod} from 'lib/updates';


export interface AppPreferences {
    updates: {
        currentVersion: string,
        availableVersion: string,
        checkPeriod: UpdatePeriod,
        lastCheck: string,
        customOptions: {
            value: number,
            interval: TimePeriod
        }
    };
}

export namespace Preferences {

    const PREFERENCES_FILE_PATH = 'preferences';

    export const DEFAULT_PREFERENCES: AppPreferences = {
        updates: {
            currentVersion: getAppVersion(),
            availableVersion: null,
            checkPeriod: UpdatePeriod.daily,
            lastCheck: null,
            customOptions: {
                value: 1,
                interval: TimePeriod.day
            }
        }
    };

    export async function load (): Promise<AppPreferences> {
        let preferences = await getJsonFile<AppPreferences>(PREFERENCES_FILE_PATH);
        if (!preferences) {
            preferences = DEFAULT_PREFERENCES;
            await save(preferences);
        }
        return preferences;
    }

    export async function save (preferences: AppPreferences): Promise<void> {
        await saveJsonFile(PREFERENCES_FILE_PATH, preferences);
    }

}
