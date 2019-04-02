import {NativeImage, nativeImage} from 'electron';
import {isMacOS, isWindows} from 'lib/platform';
import {getPath} from 'lib/urls';


export function getDefaultTrayIcon (): NativeImage {
    if (isMacOS()) {
        return nativeImage.createFromPath(getPath(require('../ui/assets/images/tray-macos-Template.png').x1.src));
    } else if (isWindows()) {
        return nativeImage.createFromPath(getPath(require('../ui/assets/images/tray-win.ico')));
    } else {
        return nativeImage.createFromPath(getPath(require('../ui/assets/images/tray-win.png').x2.src));
    }
}
