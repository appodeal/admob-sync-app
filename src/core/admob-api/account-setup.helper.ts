import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {BrowserWindow, Session} from 'electron';
import {EventEmitter} from 'events';
import {Debug} from 'lib/debug';
import {Sentry} from 'lib/sentry';
import {TaskRunner, TaskRunnerState} from 'lib/task-runner';
import {messageDialog, openDebugWindow} from 'lib/window';
import url from 'url';
import {getElementSelector} from '../../lib/dom';
import {retry} from '../../lib/retry';


let {setupOptions} = environment;

const PROJECT_NAME = setupOptions.projectName;
const APP_NAME = setupOptions.appName;
const CLIENT_NAME = setupOptions.clientName;
const DOMAINS = setupOptions.domains;
const ALLOWED_JS = setupOptions.allowedJs;
const ALLOWED_CALLBACKS = setupOptions.allowedCallbacks;


export class AccountSetup extends EventEmitter {
    window: BrowserWindow;
    private debug: Debug;
    private account: AdMobAccount;
    private runner = new TaskRunner();
    private readonly session: Session;
    private clientId: string;
    private clientSecret: string;

    once (event: 'start', listener: () => void): this;
    once (event: 'cancel', listener: () => void): this;
    once (event: 'error', listener: (error?: Error) => void): this;
    // @ts-ignore
    once (event: 'finish', listener: (clientData?: { clientId: string, clientSecret: string }) => void): this;

    // @ts-ignore
    on (event: 'progress', listener: (progress?: { total: number, completed: number, percent: number }) => void): this;

    constructor (account: AdMobAccount) {
        super();
        this.account = account;
        this.session = AdMobSessions.getSession(account);
        this.runner.once('cancel', () => this.emit('cancel'));
    }

    async start () {
        let {window, debug} = await openDebugWindow('https://console.developers.google.com', this.session);
        this.window = window;
        this.debug = debug;
        this.window.setClosable(false);

        let tosAccepted = await this.checkTermsOfService().catch(() => false);
        if (this.runner.state === TaskRunnerState.idle && tosAccepted) {
            this.initTasks();
            this.runner.on('progress', progress => this.emit('progress', progress));
            this.emit('start');
            this.runner.runTasks()
                .then(() => {
                    if (this.clientId && this.clientSecret) {
                        this.emit('finish', {
                            clientId: this.clientId,
                            clientSecret: this.clientSecret
                        });
                    } else {
                        throw new Error('Could not get clientId and clientSecret.');
                    }
                })
                .catch(err => {
                    this.emit('error', err);
                    Sentry.captureException(err);
                })
                .finally(() => {
                    this.closeWindow();
                });
        } else {
            this.closeWindow();
        }
    }

    private closeWindow () {
        this.window.setClosable(true);
        this.window.close();
    }

    stop () {
        return this.runner.break();
    }

    initTasks () {
        // Order is important
        this.findProject();
        this.selectProject();
        this.createNewProject();
        this.enableAdSense();
        this.fillOAuthAppData();
        this.createCredentials();
    }

    async checkTermsOfService () {
        const agreeCheckboxContainer = '[formgroupname="tosAcceptancesFormGroup"]';
        let required = !!(await this.debug.waitElementVisible(agreeCheckboxContainer, 5000).catch(() => false));

        if (required) {
            let userDecision = await this.askForTermsOfService();
            if (userDecision) {
                this.window.show();
                try {
                    await this.debug.evaluate(`
                    new Promise(resolve => {
                        let agreeBtn = document.querySelector('.mat-dialog-actions button');
                        if (agreeBtn) {
                            agreeBtn.addEventListener('click', function listener () {
                                agreeBtn.removeEventListener('click', listener);
                                resolve();
                            });
                        }
                    });
                `);
                } catch (e) {
                    console.error(e);
                }
                this.window.hide();
                return true;
            } else {
                return false;
            }
        }
        return true;
    }

    private async askForTermsOfService (): Promise<boolean> {
        let button = await messageDialog('Google developer console requires to accept terms ot service to continue', null, [
            {
                primary: true,
                label: 'OK',
                action: () => true
            },
            {
                cancel: true,
                label: 'Cancel',
                action: () => false
            }
        ]);
        return button.action();
    }

    findProject () {
        const projectSwitcherBtn = '[data-prober="cloud-console-core-functions-project-switcher"]';
        const newProjectBtn = '.purview-picker-create-project-button';
        const searchInput = '.cdk-overlay-pane mat-form-field.cfc-purview-picker-modal-search-box input';
        const projectNameSelector = '.cdk-overlay-pane tr:nth-child(1) a.cfc-purview-picker-list-name-link';

        let projectNodeId,
            projectName;

        this.runner.createTask(() => this.debug.waitElementVisible(projectSwitcherBtn), 'find');
        this.runner.createTask(() => this.debug.click(projectSwitcherBtn));
        this.runner.createTask(() => this.debug.waitElementVisible(newProjectBtn).catch(() => {
            this.runner.returnTo('find');
        }));
        this.runner.createTask(() => this.debug.wait(500), 'searchProject');
        this.runner.createTask(() => this.debug.waitElementVisible(searchInput));
        this.runner.createTask(() => this.debug.enterText(PROJECT_NAME, searchInput));
        this.runner.createTask(() => this.debug.wait(500));
        this.runner.createTask(async () => projectNodeId = await this.debug.waitElement(projectNameSelector).catch(() => {
            this.runner.returnTo('searchProject');
        }));
        this.runner.createTask(() => {

            if (projectNodeId) {
                return retry(async () => {
                    projectNodeId = await this.debug.waitElement(projectNameSelector);
                    projectName = await this.debug.getInnerHTML(projectNodeId);
                });
            }
        });
        this.runner.createTask(() => {
            if (projectName === PROJECT_NAME) {
                this.runner.skipTo('select', projectNodeId);
            } else {
                this.runner.skipTo('create');
            }
        });
    }

    selectProject () {
        this.runner.createTask((projectNodeId: number) => this.debug.click(projectNodeId), 'select');
        this.runner.createTask(() => this.debug.wait(2000));
        this.runner.createTask(() => this.runner.skipTo('adsense'));
    }

    createNewProject () {
        const backIcon = '.cdk-overlay-pane cfc-icon[icon="arrow-back"]';
        const newProjectBtn = '.purview-picker-create-project-button';
        const projectNameInput = '#p6ntest-name-input';
        const submitBtn = '.projtest-create-form-submit';
        const logo = 'a.cfc-logo-anchor';

        this.runner.createTask(() => this.debug.click(backIcon), 'create');
        this.runner.createTask(() => this.debug.wait(1000));
        this.runner.createTask(() => this.debug.click(newProjectBtn));
        this.runner.createTask(() => this.debug.waitElement(projectNameInput));
        this.runner.createTask(() => this.debug.enterText(PROJECT_NAME, projectNameInput));
        this.runner.createTask(() => this.debug.click(submitBtn));
        this.runner.createTask(() => this.debug.wait(20000));
        this.runner.createTask(() => this.debug.click(logo));
        this.runner.createTask(() => this.debug.wait(1000));
        this.runner.createTask(() => this.runner.returnTo('find'));
    }

    enableAdSense () {
        const libraryMenuItem = '#cfctest-section-nav-item-library';
        const adSenseCard = 'a[href^="/apis/library/adsense.googleapis.com"]';
        const enableApiBtn = '#p6n-mp-enable-api-button';
        const disableApiBtn = '[maml-ve="disableApiButton"] button';

        this.runner.createTask(() => this.debug.click(libraryMenuItem), 'adsense');
        this.runner.createTask(() => this.debug.waitElementVisible(adSenseCard));
        this.runner.createTask(() => this.debug.scrollIntoView(adSenseCard));
        this.runner.createTask(() => this.debug.click(adSenseCard));
        this.runner.createTask(() => this.debug.wait(1000));
        this.runner.createTask(async () => {
            let apiDisabled = await this.debug.isElementExistsAndVisible(enableApiBtn, 1000);
            if (!apiDisabled) {
                this.runner.skipTo('redirectToOAuth');
            }
        });
        this.runner.createTask(() => this.debug.click(enableApiBtn));
        this.runner.createTask(() => this.debug.waitElement(disableApiBtn).catch(() => {}));
        this.runner.createTask(async () => {
            let urlData = url.parse(await this.debug.getCurrentUrl());
            await this.debug.navigate(urlData.href.replace(/(api|library)\/adsense\.googleapis\.com(\/overview)?/, 'credentials/consent'));
        }, 'redirectToOAuth');
    }

    fillOAuthAppData () {
        const appNameInput = '#p6n-consent-product-name';
        const appDomainSelector = '.p6n-apiui-auth-domain';
        const appDomainInput = 'input[ng-model="ctrl.domainInput"]';
        const saveBtn = '#api-consent-save:not([disabled])';
        const supportEmailSelect = 'jfk-select[ng-model*="supportEmail"] .jfk-select';
        const supportEmailOption = 'jfk-menu[ng-model*="supportEmail"] jfk-menu-item';

        this.runner.createTask(() => this.debug.wait(1000), 'fillOAuth');
        this.runner.createTask(() => this.debug.waitElementVisible(appNameInput, 2000).catch(() => {
            this.runner.returnTo('fillOAuth');
        }));
        this.runner.createTask(() => this.debug.wait(500));
        this.runner.createTask(() => this.debug.enterText(APP_NAME, appNameInput));
        this.runner.createTask(() => this.debug.click(supportEmailSelect));
        this.runner.createTask(() => this.debug.waitElementVisible(supportEmailOption));
        this.runner.createTask(async () => {
            let nodeIds = await this.debug.querySelectorAll(supportEmailOption),
                texts = await this.debug.getTextContents(supportEmailOption),
                index = texts.findIndex(text => text.trim() === this.account.email);
            if (index !== -1) {
                await this.debug.click(nodeIds[index]);
            }
        });
        this.runner.createTask(() => this.debug.wait(500));
        this.runner.createTask(() => this.fillOnlyAbsent(DOMAINS, appDomainSelector, appDomainInput));
        this.runner.createTask(async () => {
            let hasChanges = await this.debug.isElementExistsAndVisible(saveBtn, 2000);
            if (!hasChanges) {
                this.runner.skipTo('redirectToCredentials');
            }
        });
        this.runner.createTask(() => this.debug.scrollIntoView(saveBtn));
        this.runner.createTask(() => this.debug.click(saveBtn));
        this.runner.createTask(() => this.debug.wait(2000));
        this.runner.createTask(async () => {
            let urlData = url.parse(await this.debug.getCurrentUrl());
            await this.debug.navigate(urlData.href.replace(/credentials\/consent/, 'credentials'));
        }, 'redirectToCredentials');
        this.runner.createTask(() => this.debug.wait(1000));
    }

    createCredentials () {
        const dropDownBtn = '.p6n-api-credential-dropdown';
        const credentialLabel = 'tbody .p6n-api-credential-table-label a';
        const oAuthItem = '.p6n-dropdown-row[ng-click*="OAUTH_CLIENT"]';
        const webInput = '.p6n-form-fieldset input[type="radio"][value="WEB"] + span';
        const clientNameInput = 'input[ng-model="oAuthEditorCtrl.oauthClient.displayName"]';
        const allowedJsSelector = 'form[name="originForm"] .p6n-apiui-uri-col';
        const allowedJsInput = 'form[name="originForm"] input[ng-model="ctrl.originInput"]';
        const allowedCallbacksSelector = 'form[name="redirectUriForm"] .p6n-apiui-uri-col';
        const allowedCallbackInput = 'form[name="redirectUriForm"] input[ng-model="ctrl.uriInput"]';
        const submitBtn = 'button[type="submit"]';
        const closeModalBtn = 'pan-modal-action[name="cancel"]';

        this.runner.createTask(() => this.debug.wait(1000));
        this.runner.createTask(() => this.debug.waitElementVisible(dropDownBtn)
            .catch(() => this.debug.waitElementVisible(credentialLabel)));

        // check client
        this.runner.createTask(async () => {
            let clientLabelIds = await this.debug.querySelectorAll(credentialLabel),
                clientLabels = await Promise.all(clientLabelIds.map(nodeId => this.debug.getInnerHTML(nodeId))),
                clientIndex = clientLabels.indexOf(CLIENT_NAME);
            if (clientIndex === -1) {
                this.runner.skipTo('createClient');
            } else {
                this.runner.skipTo('deleteClient', clientIndex);
            }
        }, 'checkClient');

        // delete client
        this.runner.createTask(() => this.debug.wait(500), 'deleteClient');
        // click with injected script instead
        this.runner.createTask(async () => {
            // function's name is changed during compression
            // so that we have to explicitly give a name to getElementSelector function
            const result = await this.debug.evaluate(`                
                    new Promise(resolve => {
                        let getElementSelector = ${getElementSelector.toString()}
                        let targetLabel = [...document.querySelectorAll('${credentialLabel}')].find( a => a.innerText.trim() === '${CLIENT_NAME}');
                        if (targetLabel) {
                            let section = targetLabel.closest('tr'),
                            deleteIcon = section.querySelector('.p6n-api-credential-delete'),
                            targetSelector = getElementSelector(deleteIcon)
                            
                            return resolve(targetSelector)
                        }
                        resolve();
                    });
                `, 'result').catch(e => console.warn(e));

            console.log('selector to click Delete', result.value);
            if (result.value) {
                await this.debug.click(result.value);
            }
        });

        this.runner.createTask(() => this.debug.wait(1000));
        this.runner.createTask(() => this.debug.click(`.p6n-modal-action-button[name="delete"]`));
        this.runner.createTask(() => this.debug.waitElement('.p6n-modal-content p b', 1000)
            .then(async () => {
                let text;
                text = await this.debug.getInnerHTML('.p6n-modal-content p b');
                await this.fillInput(text, 'md-dialog .p6n-form-row-input input');
                await this.debug.click(`.p6n-modal-action-button[name="delete"]`);
            })
            .catch(async () => {
                await this.debug.wait(1000);
            }));

        // create client
        // wait button
        this.runner.createTask(() => this.debug.wait(1000), 'createClient');
        this.runner.createTask(() => this.debug.click(dropDownBtn));
        this.runner.createTask(() => this.debug.waitElementVisible(oAuthItem, 2000).catch(() => this.runner.returnTo('createClient')));
        this.runner.createTask(() => this.debug.click(oAuthItem));
        this.runner.createTask(() => this.debug.waitElementVisible(webInput));
        this.runner.createTask(() => this.debug.click(webInput));
        this.runner.createTask(() => this.debug.waitElementVisible(clientNameInput));
        this.runner.createTask(() => this.debug.enterText(CLIENT_NAME, clientNameInput));
        this.runner.createTask(() => this.fillOnlyAbsent(ALLOWED_JS, allowedJsSelector, allowedJsInput));
        this.runner.createTask(() => this.fillOnlyAbsent(ALLOWED_CALLBACKS, allowedCallbacksSelector, allowedCallbackInput));
        this.runner.createTask(() => this.debug.scrollIntoView(submitBtn));
        this.runner.createTask(() => this.debug.click(submitBtn));
        this.runner.createTask(() => this.debug.waitElement(closeModalBtn));
        this.runner.createTask(async () => {
            let [clientId, clientSecret] = await this.debug.getTextContents('[type="key-selector"] ng-transclude');
            this.clientId = clientId.trim();
            this.clientSecret = clientSecret.trim();
        });
    }


    private async fillInput (text: string, selector: string) {
        await this.debug.enterText(text, selector);
        await this.debug.wait(500);
        await this.debug.emulateEnter();
        await this.debug.wait(500);
    }

    private async fillOnlyAbsent (texts: Array<string>, existingItemSelector: string, inputSelector: string) {
        let nodeIds = await this.debug.querySelectorAll(existingItemSelector),
            existingItems = new Set(await Promise.all(
                nodeIds.map(nodeId => this.debug.getHTML(nodeId).then(html => html.inner))
            )),
            itemsToAdd = texts.filter(text => !existingItems.has(text));
        for (let text of itemsToAdd) {
            await this.fillInput(text, inputSelector);

            await this.debug.waitCondition(async () => {
                // await filled node appearance
                nodeIds = await this.debug.querySelectorAll(existingItemSelector);
                existingItems = new Set(await Promise.all(
                    nodeIds.map(nodeId => this.debug.getHTML(nodeId).then(html => html.inner))
                ));
                return existingItems.has(text);
            });
        }
    }

}
