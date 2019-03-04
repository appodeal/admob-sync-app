import {dialog} from 'electron';
import {PackageJson} from 'package-json';
import packageInfo from './../../package.json';
import {getAppIcon} from './icon';


export function getPackageInfo (): PackageJson {
    return packageInfo as PackageJson;
}

function getAboutTitle () {
    return `${packageInfo.productName}`;
}

function getAboutDetails () {
    let yearStart = 2019,
        yearEnd = new Date().getFullYear();
    return [
        `Version: ${packageInfo.version}`,
        ``,
        `Copyright \u00A9 ${yearStart === yearEnd ? yearEnd : `${yearStart} - ${yearEnd}`}, ${packageInfo.author}`
    ].join('\n');
}

export function showAboutDialog () {
    dialog.showMessageBox({
        type: 'info',
        icon: getAppIcon(),
        message: getAboutTitle(),
        detail: getAboutDetails()
    });
}
