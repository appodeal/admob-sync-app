import platform from 'electron-platform';
import {NativeImage, nativeImage} from 'electron';
import {getPath} from './common';


export function getTrayIcon (): NativeImage {
    if (platform.isDarwin) {
        return nativeImage.createFromPath(getPath(require('../ui/assets/images/tray-macos-Template.png').x1.src));
    } else {
        return nativeImage.createFromPath(require('../ui/assets/images/tray-macos-Template.png').x1.src);
    }
}

export function getAppIcon (): NativeImage {
    return nativeImage.createFromPath(getPath(require('../ui/assets/images/icon-128.png').x1.src));
}
