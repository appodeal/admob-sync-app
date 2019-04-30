import {app} from 'electron';


export function showDock () {
    if (app.dock) {
        app.dock.show();
    }

}

export function hideDock () {
    if (app.dock) {
        app.dock.hide();
    }
}
