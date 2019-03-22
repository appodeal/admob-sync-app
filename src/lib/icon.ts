import platform from 'electron-platform';
import {NativeImage, nativeImage} from 'electron';
import {getPath} from 'lib/urls';


export function getDefaultTrayIcon (): NativeImage {
    if (platform.isDarwin) {
        return nativeImage.createFromPath(getPath(require('../ui/assets/images/tray-macos-Template.png').x1.src));
    } else {
        return nativeImage.createFromPath(getPath(require('../ui/assets/images/tray-win.png').x2.src));
    }
}
