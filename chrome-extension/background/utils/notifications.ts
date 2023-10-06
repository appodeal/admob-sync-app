import uuid from 'uuid';


export function notify (title, message, id?) {
    id = id || uuid.v4();

    chrome.notifications.create(id, {
        type: 'basic',
        title: title,
        message: message,
        iconUrl: 'img/icon/icon-64.png'
    });
}

export function notifyError (e: Error) {
    return notify('Error has occured', e.message);
}
