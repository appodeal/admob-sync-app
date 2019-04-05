import {AppodealAccountState} from 'interfaces/common.interfaces';
import {getAppVersion} from 'lib/about';
import {deepAssign, deepFreeze} from 'lib/core';
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
    accounts: {
        appodealAccounts: Array<AppodealAccountState>
    };
    multipleAccountsSupport: boolean
}

export namespace Preferences {

    const PREFERENCES_FILE_PATH = 'preferences';

    export const DEFAULT_PREFERENCES = deepFreeze<AppPreferences>({
        updates: {
            currentVersion: getAppVersion(),
            availableVersion: null,
            checkPeriod: UpdatePeriod.daily,
            lastCheck: null,
            customOptions: {
                value: 1,
                interval: TimePeriod.day
            }
        },
        accounts: {
            appodealAccounts: []
        },
        multipleAccountsSupport: false
    });

    export async function load (): Promise<AppPreferences> {
        let preferences = await getJsonFile<AppPreferences>(PREFERENCES_FILE_PATH);
        if (!preferences) {
            preferences = deepAssign<AppPreferences>({}, DEFAULT_PREFERENCES);
            await save(preferences);
        } else {
            preferences = deepAssign({}, DEFAULT_PREFERENCES, preferences);
        }
        preferences.multipleAccountsSupport = environment.multipleAccountsSupport;
        return preferences;
    }

    export async function save (preferences: AppPreferences): Promise<void> {
        await saveJsonFile(PREFERENCES_FILE_PATH, preferences);
    }

}
