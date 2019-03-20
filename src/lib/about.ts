import {dialog} from 'electron';
import packageInfo from './../../package.json';


function getAboutTitle () {
    return `${packageInfo.productName}`;
}

function getAboutDetails () {
    let yearStart = 2019,
        yearEnd = new Date().getFullYear();
    return [
        `Version: ${packageInfo.version}`,
        ``,
        `Copyright \u00A9 ${yearStart === yearEnd ? yearEnd : `${yearStart} - ${yearEnd}`}, ${typeof packageInfo.author === 'object' ?
            packageInfo.author.name :
            packageInfo.author}`
    ].join('\n');
}

export function showAboutDialog () {
    dialog.showMessageBox({
        type: 'info',
        message: getAboutTitle(),
        detail: getAboutDetails()
    });
}
