import { app, BrowserWindow } from 'electron'

function createWindow () {
    // Создаем окно браузера.
    let win = new BrowserWindow({
        width: 800,
        height: 600,
    });

    console.log('44');

    // and load the index.html of the app.
    win.loadFile(environment.index)
}

app.on('ready', createWindow);
