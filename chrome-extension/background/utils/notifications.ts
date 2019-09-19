import uuid from 'uuid';


export function notify (title, message, id?) {
    id = id || uuid.v4();
    const opt = {
        type: 'basic',
        title: title,
        message: message,
        iconUrl: 'img/icon/icon-64.png'
    };

    chrome.notifications.create(id, opt);
}

export function notifyError (e: Error) {
    return notify('Error has occured', e.message);
}
