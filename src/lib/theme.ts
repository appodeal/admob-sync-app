import {ipcMain, nativeTheme, systemPreferences} from 'electron';
import {isMacOS} from 'lib/platform';


export enum AppAppearance {
    dark = 'dark',
    light = 'light'
}


const listeners = new Set<(appearance: AppAppearance) => void>();
let interval,
    previousValue;

export function onThemeChanges (listener: (appearance: AppAppearance) => void): Function {
    previousValue = isDark();
    listeners.add(listener);
    if (listeners.size === 1) {
        interval = setInterval(() => {
            let newValue = isDark();
            if (newValue !== previousValue) {
                execThemeListeners(newValue);
                previousValue = newValue;
            }

        }, 50);
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            clearInterval(interval);
        }
    };
}

function execThemeListeners (isDark) {
    for (let callback of listeners) {
        callback(isDark ? AppAppearance.dark : AppAppearance.light);
    }
}

export function isDark () {
    if (isMacOS()) {
        return nativeTheme.shouldUseDarkColors;
    } else {
        return true;
    }
}

export function getCurrentTheme (): AppAppearance {
    return isDark() ? AppAppearance.dark : AppAppearance.light;
}

export function getBgColor (): string {
    return isDark() ? 'rgb(56,55,55)' : 'rgb(236,236,236)';
}


export function initThemeSwitcher () {
    if (isMacOS()) {
        systemPreferences.setAppLevelAppearance(getCurrentTheme());
        onThemeChanges(appearance => {
            systemPreferences.setAppLevelAppearance(appearance);
        });
        ipcMain.on('theme', (event, appearance) => {
            execThemeListeners(appearance === 'dark');
        });
    }

}



