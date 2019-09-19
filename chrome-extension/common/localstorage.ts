export const extLocalStorage = {
    async set (value) {
        return new Promise(resolve => chrome.storage.local.set(value, resolve));
    },
    async get (value) {
        return new Promise(resolve => chrome.storage.local.get(value, resolve));
    }
};

