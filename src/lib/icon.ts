import {NativeImage, nativeImage} from 'electron';
import {isMacOS, isWindows} from 'lib/platform';
import {getPath} from 'lib/urls';


export function getSyncingTrayIcon (num: number): NativeImage {
    if (isMacOS()) {
        return nativeImage.createFromPath(getPath(require(`../ui/assets/images/tray/mac-syncing/syncing-${num}-Template.png`).x1.src));
    }
    if (isWindows()) {
        return nativeImage.createFromPath(getPath(require(`../ui/assets/images/tray/win-syncing/syncing-${num}.ico`)));
    }

    return nativeImage.createFromPath(getPath(require(`../ui/assets/images/tray/win-syncing/syncing-${num}.png`).x2.src));
}


export function getWarningTrayIcon (): NativeImage {
    if (isMacOS()) {
        return nativeImage.createFromPath(getPath(require('../ui/assets/images/tray/mac-warn/warning-Template.png').x1.src));
    }
    if (isWindows()) {
        return nativeImage.createFromPath(getPath(require('../ui/assets/images/tray/win-warn/warn-win.ico')));
    }

    return nativeImage.createFromPath(getPath(require('../ui/assets/images/tray/win-warn/warn-win.png').x2.src));
}


export function getDefaultTrayIcon (): NativeImage {
    if (isMacOS()) {
        return nativeImage.createFromPath(getPath(require('../ui/assets/images/tray/mac-default/tray-macos-Template.png').x1.src));
    }
    if (isWindows()) {
        return nativeImage.createFromPath(getPath(require('../ui/assets/images/tray/win-default/tray-win.ico')));
    }

    return nativeImage.createFromPath(getPath(require('../ui/assets/images/tray/win-default/tray-win.png').x2.src));
}
