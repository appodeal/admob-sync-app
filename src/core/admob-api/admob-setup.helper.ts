import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {BrowserWindow} from 'electron';
import {AdMobAccount} from 'interfaces/appodeal.interfaces';
import {createScript, getRandomNumberString, goToPage, openWindow, waitForNavigation} from 'lib/common';


export namespace AdMobSetup {

    const PROJECT_NAME = 'Appodeal-test';
    const APP_NAME = 'Appodeal Revenue';
    const APP_DOMAIN = 'appodeal.com';

    interface AdMobProject {
        display_name: string;
        id: string;
    }

    type GoogleApiFetcher = <T>(url: string, options: RequestInit) => Promise<T>;

    export async function startSetup (account: AdMobAccount): Promise<boolean> {
        let window = await openGoogleConsole(account),
            success = false,
            projectId,
            fetcher = createGoogleApiFetcher(window);

        // window.webContents.openDevTools({mode: 'right'});

        delay(10000)
            .then(() => isTosRequired(fetcher))
            .then(required => handleTermsOfService(required, window))
            .then(() => handleAppodealProject(fetcher, window))
            .then(pid => goToAdSensePage(window, projectId = pid))
            .then(() => handleAdSense(window, projectId))
        //     .then(() => goToCredentialsPage(window, projectId))
        //     .then(() => fillCredentialForm(window, projectId))
        //     .then(() => window.show())
        // .then(() => window.close());
        .catch(reason => console.log(reason));


        return new Promise(resolve => {
            window.once('close', () => resolve(success));
        });
    }


    /**
     * creates fetch function, which works in page context and transform response to correct object
     * @param {BrowserWindow} window
     * @return {GoogleApiFetcher}
     */
    function createGoogleApiFetcher (window: BrowserWindow): GoogleApiFetcher {
        return async (url: string, options) => {
            let textResult = await window.webContents.executeJavaScript(createScript((url, options) => {
                debugger;
                if (options.body instanceof Object) {
                    options.body = JSON.stringify(options.body);
                }
                return fetch(url, options).then(response => response.text());
            }, url, options));
            textResult = textResult.replace(/^\)]}'/, '').trim();
            return JSON.parse(textResult);
        };
    }


    /**
     * opens hidden window with developer google console
     * @param {AdMobAccount} account
     * @return {Promise<BrowserWindow>}
     */
    function openGoogleConsole (account: AdMobAccount): Promise<BrowserWindow> {
        return openWindow('https://console.developers.google.com/', {
            // show: false,
            width: 560,
            minWidth: 560,
            height: 700,
            minHeight: 700,
            minimizable: false,
            // maximizable: false,
            // fullscreenable: false,
            fullscreen: true,
            frame: true,
            titleBarStyle: 'default',
            webPreferences: {
                session: AdMobSessions.getSession(account),
                allowRunningInsecureContent: true,
                webSecurity: false
            }
        });
    }


    /**
     * asks user to accept terms of service if it is required, and hides window after that
     * @param {boolean} required
     * @param {BrowserWindow} window
     * @return {Promise<void>}
     */
    async function handleTermsOfService (required: boolean, window: BrowserWindow): Promise<void> {
        if (required) {
            showTosWindow(window);
            await waitForTosAccept(window);
            // window.hide();
            window.setClosable(true);
        }
    }


    /**
     * Makes a check, is it required to accept terms of service
     * @param {GoogleApiFetcher} fetcher
     * @return {Promise<boolean>}
     */
    function isTosRequired (fetcher: GoogleApiFetcher): Promise<boolean> {
        return fetcher<{ tos: Array<any> }>('https://console.developers.google.com/m/tos/required', {
            method: 'GET'
        }).then(response => {
            let isRequired = response.tos.length !== 0;
            console.log(`TOS required: ${isRequired}`);
            return isRequired;
        });
    }


    /**
     * shows window with terms of service
     * @param {BrowserWindow} window
     */
    function showTosWindow (window: BrowserWindow) {
        window.webContents.insertCSS(`
                #cdk-overlay-0 {
                    width: 100vw;
                    max-width: 100vw !important;
                    height: 100vh;
                }
                .mat-dialog-container {
                    border-radius: 0 !important;
                }
            `);
        window.setClosable(false);
        // window.show();
    }


    /**
     * waits for a moment when user accepts terms of service in opened window
     * @param {BrowserWindow} window
     * @return {Promise<void>}
     */
    function waitForTosAccept (window: BrowserWindow): Promise<void> {
        return window.webContents.executeJavaScript(createScript(() => new Promise(resolve => {
            let interval = setInterval(() => {
                let submitButton = document.querySelector('#cdk-overlay-0 button.mat-primary');
                if (submitButton) {
                    clearInterval(interval);
                    submitButton.addEventListener('click', () => resolve(), {once: true});
                }
            }, 100);
        })));
    }


    /**
     * Returns project id of project with name "Appodeal". If it doesn't exist, creates it.
     * @param {GoogleApiFetcher} fetcher
     * @param {BrowserWindow} window
     * @return {Promise<string>}
     */
    async function handleAppodealProject (fetcher: GoogleApiFetcher, window: BrowserWindow): Promise<string> {
        let projectId = await checkForExistingProject(fetcher);
        console.log(`Project "${PROJECT_NAME}" ${projectId ? `already exists with id ${projectId}` : 'does not exist'}`);
        if (!projectId) {
            console.log(`Creating project ${PROJECT_NAME}`);
            await createProject(fetcher, window);
            projectId = await checkForExistingProject(fetcher);
            console.log(`Project ${PROJECT_NAME} has been created with id: ${projectId}`);
        }
        return projectId;
    }


    /**
     * Makes a check for a project with name "Appodeal". Returns project id.
     * @param {GoogleApiFetcher} fetcher
     * @return {Promise<string>}
     */
    async function checkForExistingProject (fetcher: GoogleApiFetcher): Promise<string> {
        let project = await fetcher<{ items: Array<{ descriptionLocalizationArgs: { name: string, assignedIdForDisplay: string } }> }>(
            'https://console.developers.google.com/m/operations?authuser=0&maxResults=100',
            {method: 'GET'}
        )
            .then(data => data.items.find(project => project.descriptionLocalizationArgs.name === PROJECT_NAME));
        if (project) {
            return project.descriptionLocalizationArgs.assignedIdForDisplay;
        }
        return null;
    }


    /**
     * Creates a project with name "Appodeal".
     * @param {GoogleApiFetcher} fetcher
     * @param {BrowserWindow} window
     */
    async function createProject (fetcher: GoogleApiFetcher, window: BrowserWindow): Promise<any> {
        let [pid, xsrfToken] = await Promise.all([
            getProjectId(fetcher),
            getXsrfToken(window)
        ]);
        return fetcher<AdMobProject>(
            'https://console.developers.google.com/m/operations?supportedpurview=project&operationType=cloud-console.project.createProject',
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json; charset=UTF-8',
                    'x-framework-xsrf-token': xsrfToken
                },
                credentials: 'include',
                mode: 'cors',
                body: <any>{
                    enableCloudApisInServiceManager: false,
                    assignedIdForDisplay: pid,
                    generateProjectId: 'false',
                    name: PROJECT_NAME,
                    isAe4B: 'undefined',
                    billingAccountId: null,
                    descriptionLocalizationKey: 'panCreateProject',
                    descriptionLocalizationArgs: {
                        name: PROJECT_NAME,
                        assignedIdForDisplay: pid,
                        isAe4B: 'undefined',
                        organizationId: null
                    },
                    phantomData: {
                        phantomRows: [
                            {
                                displayName: PROJECT_NAME,
                                type: 'PROJECT',
                                lifecycleState: 'ACTIVE',
                                id: pid,
                                organizationId: null,
                                name: `projects/${pid}`
                            }
                        ]
                    }
                }
            }
        );
    }


    /**
     * Returns a promise with xsrf token for google developer console
     * @param {BrowserWindow} window
     * @return {Promise<string>}
     */
    function getXsrfToken (window: BrowserWindow): Promise<string> {
        return window.webContents.executeJavaScript(createScript(() => {
            let xsrfToken = window['pantheon_main_init_args'][1]._;
            if (!xsrfToken) {
                xsrfToken = window['pantheon_main_init_args'][0]._;
            }
            return xsrfToken;
        }));
    }


    /**
     * Generates project id and returns a promise with it.
     * @param {GoogleApiFetcher} fetcher
     * @return {Promise<string>}
     */
    async function getProjectId (fetcher: GoogleApiFetcher): Promise<string> {
        let available = false,
            pid;
        while (!available) {
            pid = `appodeal-${getRandomNumberString(6)}`;
            let result = await fetcher<{ available: boolean }>(
                `https://console.developers.google.com/m/projectidsuggestion?authuser=0&pidAvailable=${pid}`,
                {method: 'GET'}
            );
            available = result.available;
        }
        return pid;
    }


    /**
     * Makes a redirect to AdSense management page
     * @param {BrowserWindow} window
     * @param {string} projectId
     * @return {Promise<void>}
     */
    function goToAdSensePage (window: BrowserWindow, projectId: string): Promise<void> {
        return goToPage(window, `https://console.developers.google.com/apis/api/adsense.googleapis.com/overview?project=${projectId}`);
    }


    /**
     * Makes a redirect to credentials setup page
     * @param {BrowserWindow} window
     * @param {string} projectId
     * @return {Promise<void>}
     */
    function goToCredentialsPage (window: BrowserWindow, projectId: string): Promise<void> {
        return goToPage(window, `https://console.developers.google.com/apis/credentials/consent?project=${projectId}`);
    }


    /**
     * Enables AdSense API if it's required.
     * @param {BrowserWindow} window
     * @param {string} projectId
     * @return {Promise<void>}
     */
    async function handleAdSense (window: BrowserWindow, projectId: string): Promise<void> {
        await waitForElement(window, 'iframe[src*="servicemanagement"]', 10000);
        let apiKey = await getApiKey(window),
            isEnabled  = await isAdSenseEnabled(window, apiKey, projectId);
        console.log(`AdSense enabled: ${isEnabled}`);
        if (!isEnabled) {
            console.log('Enabling AdSense');
            await enableAdSense(window, apiKey, projectId);
            console.log('AdSense enabled');
        }


        // let disableBtn = 'maml-button maml-disable',
        //     enableBtn = '[ng-show*="!promiseResolved"][aria-hidden="true"] + span [instrumentation-id="api-enable-adsense.googleapis.com"]',
        //     found = await Promise.race([
        //         waitForElement(window, disableBtn, 10000),
        //         waitForElement(window, enableBtn, 10000)
        //     ]);
        // if (found === enableBtn) {
        //     console.log('enabling AdSense...');
        //     await clickOnElement(window, '[instrumentation-id="api-enable-adsense.googleapis.com"]');
        //     await waitForElement(window, 'maml-button maml-disable', 10000);
        //     console.log('AdSense enabled');
        // }
    }


    async function fillCredentialForm (window: BrowserWindow, projectId: string): Promise<void> {
        await waitForElement(window, '[ng-model="ctrl.oauthBrand.displayName"]');
        await fillInput(window, '[ng-model="ctrl.oauthBrand.displayName"]', APP_NAME);
        let hasDomain = await checkElement(window, '[ng-if*="ctrl.approvedItems.length"] tbody td:nth-child(2)', el => {
            return el.textContent.trim() === 'appodeal.com';
        });
        if (!hasDomain) {
            await fillInput(window, '[ng-model="ctrl.domainInput"]', APP_DOMAIN);
        }
        let hasChanges = await checkElement(window, '#api-consent-save[aria-disabled="false"]');
        if (hasChanges) {
            await clickOnElement(window, '#api-consent-save');
            await waitForNavigation(window, `https://console.developers.google.com/apis/credentials?project=${projectId}`);
        } else {
            await goToPage(window, `https://console.developers.google.com/apis/credentials?project=${projectId}`);
        }
    }


    function clickOnElement (window: BrowserWindow, selector: string) {
        return window.webContents.executeJavaScript(createScript((selector) => {
            return new Promise(resolve => setTimeout(() => {
                let element = document.querySelector(selector) as HTMLElement;
                if (element) {
                    if (element.hasAttribute('jfk-on-action')) {
                        let propertyRegexp = /([\w]+)(\([^)]*\))?/,
                            action = element
                                .getAttribute('jfk-on-action')
                                .split('.')
                                .reduce((target, prop, index, parts) => {
                                    let [, propName, invocation] = propertyRegexp.exec(prop);
                                    let value = target[propName];
                                    if (invocation) {
                                        if (index === parts.length - 1) {
                                            return value.bind(target);
                                        }
                                        return value.call(target);
                                    }
                                    return value;
                                }, window['angular'].element(element).controller().$scope);
                        if (typeof action === 'function') {
                            action();
                        }
                    } else {
                        element.dispatchEvent(new MouseEvent('click', {bubbles: true}));
                    }
                }
                resolve();
            }, 300));
        }, selector));
    }

    // async function clickOnElement (window: BrowserWindow, selector: string) {
    //     let rect = await window.webContents.executeJavaScript(createScript((selector) => {
    //         return new Promise(resolve => setTimeout(() => {
    //             let element = document.querySelector(selector) as HTMLElement;
    //             if (element) {
    //                 element.scrollIntoView();
    //                 setTimeout(() => {
    //                     let {left, top, width, height} = element.getBoundingClientRect();
    //                     resolve({left, top, width, height});
    //                 }, 300);
    //             } else {
    //                 resolve();
    //             }
    //         }, 100));
    //     }, selector));
    //     if (rect) {
    //         window.webContents.sendInputEvent({
    //             type: 'mouseDown',
    //             clickCount: 1,
    //             button: 'left',
    //             x: Math.round(rect.left + rect.width / 2),
    //             y: Math.round(rect.top + rect.height / 2)
    //         } as any);
    //         window.webContents.sendInputEvent({
    //             type: 'mouseDown',
    //             clickCount: 1,
    //             button: 'left',
    //             x: Math.round(rect.left + rect.width / 2),
    //             y: Math.round(rect.top + rect.height / 2)
    //         } as any);
    //     }
    // }

    function fillInput (window: BrowserWindow, selector: string, value: string): Promise<void> {
        return window.webContents.executeJavaScript(createScript((selector, value) => {
            return new Promise(resolve => {
                let input = document.querySelector(selector) as HTMLInputElement;
                if (input) {
                    input.focus();
                    input.value = value;
                    input.dispatchEvent(new Event('input', {bubbles: true}));
                    input.dispatchEvent(new Event('blur', {bubbles: true}));
                    setTimeout(() => resolve(), 100);
                } else {
                    resolve();
                }
            });

        }, selector, value));
    }

    function waitForElement (window: BrowserWindow, selector: string, maxWaitTime = 5000) {
        return window.webContents.executeJavaScript(createScript((selector, maxWaitTime) => {
            return new Promise((resolve, reject) => {
                let interval,
                    timeout = setTimeout(() => {
                        clearInterval(interval);
                        reject(`Can't find element with selector: ${selector} during ${maxWaitTime}ms.`);
                    }, maxWaitTime);
                interval = setInterval(() => {
                    let el = document.querySelector(selector);
                    if (el) {
                        clearTimeout(timeout);
                        clearInterval(interval);
                        setTimeout(() => resolve(selector), 100);
                    }
                }, 100);
            });
        }, selector, maxWaitTime));
    }

    function checkElement (window: BrowserWindow, selector: string, checker?: (element: HTMLElement) => boolean): Promise<boolean> {
        return window.webContents.executeJavaScript(createScript((selector, checker) => {
            return new Promise(resolve => {
                let elements = document.querySelectorAll(selector);
                if (checker) {
                    resolve([...elements].some(element => checker(element)));
                } else {
                    resolve(!!elements.length);
                }
            });
        }, selector, checker || null));
    }

    function getApiKey (window: BrowserWindow) {
        return window.webContents.executeJavaScript(createScript(() => {
            return /pantheon_apiKey\\x22:\\x22(?<apiKey>[\w_\-]+)\\x22/.exec(document.body.innerHTML).groups.apiKey;
        }));
    }

    function enableAdSense (window: BrowserWindow, apiKey: string, projectId: string): Promise<void> {
        return window.webContents.executeJavaScript(createScript((apiKey, projectId) => {
            let frame = document.querySelector('iframe[src*="servicemanagement"]') as HTMLIFrameElement;
            if (frame) {
                return frame.contentWindow.fetch(
                    `https://servicemanagement.clients6.google.com/v1/services:activate?alt=json&key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': window['gapi']._.lq([]),
                            'X-Goog-AuthUser': '0',
                            'X-Goog-Encode-Response-If-Executable': 'base64',
                            'X-JavaScript-User-Agent': 'google-api-javascript-client/1.1.0',
                            'X-Origin': 'https://console.developers.google.com',
                            'X-Referer': 'https://console.developers.google.com',
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: JSON.stringify({
                            consumerProjectId: projectId,
                            serviceNames: ['adsense.googleapis.com']
                        })
                    }
                ).then(response => response.json());
            }
        }, apiKey, projectId));
    }

    function isAdSenseEnabled (window: BrowserWindow, apiKey: string, projectId: string): Promise<boolean> {
        return window.webContents.executeJavaScript(createScript((apiKey, projectId) => {
            let frame = document.querySelector('iframe[src*="servicemanagement"]') as HTMLIFrameElement;
            if (frame) {
                return frame.contentWindow.fetch(
                    `https://servicemanagement.clients6.google.com/v1/services/adsense.googleapis.com?expand=projectSettings&view=CONSUMER_VIEW&consumerProjectId=${projectId}&key=${apiKey}`,
                    {
                        method: 'GET',
                        headers: {
                            'Authorization': window['gapi']._.lq([]),
                            'X-Goog-AuthUser': '0',
                            'X-Goog-Encode-Response-If-Executable': 'base64',
                            'X-JavaScript-User-Agent': 'google-api-javascript-client/1.1.0',
                            'X-Origin': 'https://console.developers.google.com',
                            'X-Referer': 'https://console.developers.google.com',
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    }
                ).then(response => response.json());
            }
        }, apiKey, projectId))
            .then(data => {
                return data.projectSettings.usageSettings.consumerEnableStatus === 'ENABLED';
            });
    }


    function delay (ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
