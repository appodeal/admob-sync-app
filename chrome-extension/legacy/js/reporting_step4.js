var ReportingStepFourController, modal, credentials_interval, redirect_uri = REDIRECT_URI;
var angular = require('angular');

ReportingStepFourController = (function () {
    let environment;

    var initOtherLibrary, waitForCredentials, outhclientPageLink, startCredentialsCreating,


        findAppodealClient,
        waitUntilClientInfoPresent;

    initOtherLibrary = function (message) {
        sendOut(0, message);
        appendJQuery(function () {
            modal = new Modal();
            modal.show('Appodeal Chrome Extension', message);
        });
    };
    waitForCredentials = function () {
        var download_links, no_clients;
        try {
            no_clients = jQuery('.p6n-zero-state-widget');
            download_links = jQuery('body').find('a.jfk-button.jfk-button-flat[download]');
            if (download_links.length) {
                clearInterval(credentials_interval);
                fetchCredentials(download_links);
            } else if (no_clients.length) {
                clearInterval(credentials_interval);
                startCredentialsCreating();
            } else {
                console.log('Credential not found!');
                startCredentialsCreating();
            }
        } catch (err) {
            Sentry.captureException(err);
        }
    };
    outhclientPageLink = function () {
        try {
            return oauthPageUrl(locationProjectName());
        } catch (err) {
            Sentry.captureException(err);
        }
    };
    startCredentialsCreating = function () {
        try {
            console.log('Start credentials creating');
            document.location = outhclientPageLink();
        } catch (err) {
            Sentry.captureException(err);
        }
    };

    function getClientIdAndSecretIdFromDetailsAndRun () {
        var clientId, clientSecret, secretSpan;
        try {
            clientId = jQuery('div.p6n-kv-list-value span').first().text().trim();
            secretSpan = jQuery('div[ng-if=\'ctrl.isSecretVisible() && ctrl.client.clientSecret\'] .p6n-kv-list-value span');
            clientSecret = secretSpan.text().trim();
            checkAndSaveClientCredentials(clientId, clientSecret);
        } catch (err) {
            Sentry.captureException(err);
        }
    };

    function resetCredentialSecret () {
        setTimeout((function () {
            var promptRegenerateCode, secretSpan;
            try {
                secretSpan = jQuery('div[ng-if=\'ctrl.isSecretVisible() && ctrl.client.clientSecret\'] .p6n-kv-list-value span');
                if (secretSpan.length) {
                    getClientIdAndSecretIdFromDetailsAndRun();
                } else {
                    if (jQuery('jfk-button[jfk-on-action=\'ctrl.promptRegenerateSecret()\']').length) {
                        console.log('reset secret');
                        promptRegenerateCode = 'angular.element($("jfk-button[jfk-on-action=\'ctrl.promptRegenerateSecret()\'")).controller().promptRegenerateSecret(); setTimeout(function() { $("button[jfk-on-action=\'confirmCallback($event)\']").click();}, 1500)';
                        run_script(promptRegenerateCode);
                        setTimeout((function () {
                            var secretSpan;
                            secretSpan = jQuery('div[ng-if=\'ctrl.isSecretVisible() && ctrl.client.clientSecret\'] .p6n-kv-list-value span');
                            if (secretSpan.length) {
                                getClientIdAndSecretIdFromDetailsAndRun();
                            } else {
                                console.log('secret is still not found');
                            }
                        }), 3000);
                    } else {
                        console.log('promptRegenerateSecret button not found.');
                    }
                }
            } catch (err) {
                Sentry.captureException(err);
            }
        }), 1000);
    };

    function checkAndSaveClientCredentials (clientId, clientSecret) {
        var message, webClientLink;
        if (clientId && clientSecret) {
            addAdmobAccount(clientId, clientSecret);
        } else if (clientId) {
            console.log('Credential client_id found, but client_secret not found. Try to reset.');
            console.log('Go to the Appodeal web client');
            webClientLink = findAppodealClient().find('a[ng-href]').attr('href');
            document.location = webClientLink;
        } else {
            message = 'Credential client id not found. Please ask for support.';
            sendOut(1, message);
            modal.show('Appodeal Chrome Extension', message);
            chrome.storage.local.remove('reporting_tab_id');
        }
    };

    function fetchCredentials (download_links) {
        console.log('fetchCredentials');
        getIdAndSecret(download_links, function (credential) {
            console.log('Credentials fetched');
            if (credential.id && credential.secret) {
                checkAndSaveClientCredentials(credential['id'], credential['secret']);
            } else {
                startCredentialsCreating();
            }
        });
    };

    function addAdmobAccount (clientId, clientSecret) {
        modal.show(
            'Appodeal Chrome Extension',
            'Please grant permission to Appodeal to read your Admob reports.<br>You will be automatically redirected in 5 seconds.'
        );
        (new Promise(resolve => {
            chrome.runtime.onMessage.addListener(function (request, sender) {
                if (request.type === 'updateAdmobAccountCredentialsUpdated') {
                    console.log(request);
                    resolve(request.oAuthUrl);
                }
            });
            chrome.runtime.sendMessage({type: 'updateAdmobAccountCredentials', client_id: clientId, client_secret: clientSecret});
        })).then((final_href) => {
            console.log('redirecting to oauth...');
            chrome.storage.local.remove('reporting_tab_id');
            setTimeout(() => {
                document.location.href = final_href;
            }, 3000);
        }, (e) => {
            console.log('Error creating admob account on appodeal. ');
            console.error(e);
            Sentry.captureException(e);
        });
    };

    function getIdAndSecret (download_links, callback) {
        try {
            var result = {
                id: null,
                secret: null
            };
            $.each(download_links, function () {
                if (result.id) {
                    return;
                }
                var data = JSON.parse(this.getAttribute('content'));
                if (data.web && data.web.javascript_origins && Array.isArray(data.web.javascript_origins) && data.web.redirect_uris && Array.isArray(
                    data.web.redirect_uris)) {
                    if (environment.setupOptions.allowedJs.every(v => data.web.javascript_origins.includes(v))
                        && environment.setupOptions.allowedCallbacks.every(v => data.web.redirect_uris.includes(v))) {
                        result.id = data.web.client_id;
                        result.secret = data.web.client_secret;
                        return true;
                    }
                } else {
                    if (data.web) { console.log(data.web); }
                }
            });
            callback(result);
        } catch (err) {
            Sentry.captureException(err);
        }
    };
    findAppodealClient = function () {
        try {
            return jQuery('tr[pan-table-row] td a[content*=\'appodeal.com/admin/oauth2callback\']').parents('tr[pan-table-row]');
        } catch (err) {
            Sentry.captureException(err);
        }
    };
    waitUntilClientInfoPresent = function () {
        window.setInterval((function () {
            try {
                console.log('Redirect to credentials page');
                document.location = credentialPageUrl(locationProjectName());
            } catch (err) {
                Sentry.captureException(err);
            }
        }), 5000);
    };

    function addCredentials () {
        const origins = [
            APPODEAL_URL,
            APPODEAL_URL_NOT_WWW,
            APPODEAL_URL_SSL,
            APPODEAL_URL_SSL_NOT_WWW
        ].concat(environment.setupOptions.allowedJs).filter(onlyUniqueCaseInsensitive);
        const redirectUris = origins.map(origin => origin + '/admin/oauth2callback')
            .concat(environment.setupOptions.allowedCallbacks)
            .filter(onlyUniqueCaseInsensitive);
        try {
            console.log('Redirected to oauthclient creating page.');
            setTimeout((function () {
                console.log('Select Web application');
                run_script('jQuery("input[value=\'WEB\']").click();');
                setTimeout((function () {
                    var name_code, origins_code, redirect_uris_code, submit_form_code;
                    console.log('Insert display name, redirect and origins urls');
                    var old_name_element = '[ng-model=\'oAuthEditorCtrl.client.displayName\']';
                    if (angular.element(old_name_element)[0] == null) {

                        name_code = '[ng-model=\'oAuthEditorCtrl.oauthClient.displayName\']';
                        origins_code = '[ng-model=\'ctrl.originInput\']';
                        redirect_uris_code = '[ng-model=\'ctrl.uriInput\']';

                        var wait = function (time) {
                            return new Promise((resolve) => {
                                setTimeout(() => {
                                    resolve();
                                }, time);
                            });
                        };

                        var updateInput = (input, value, otherInput) => {
                            return new Promise(resolve => {
                                setTimeout(() => {
                                    angular.element(input).focus();
                                    angular.element(input).val(value);
                                    if (angular.element(input)[0]) {
                                        angular.element(input)[0].dispatchEvent(new Event('input'));
                                    }
                                    document.querySelector(input).dispatchEvent(new Event('input'));
                                    if (otherInput) {
                                        setTimeout(() => {
                                            angular.element(otherInput).focus();
                                            document.querySelector(otherInput).focus();
                                        }, 100);
                                        setTimeout(() => {
                                            resolve();
                                        }, 1500);
                                    } else {
                                        resolve();
                                    }
                                });
                            }, 1000);
                        };

                        var actions = [];
                        var addActions = (newActions) => {
                            if (Array.isArray(newActions)) {
                                actions = [...actions, ...newActions];
                            } else {
                                actions.push(newActions);
                            }
                        };
                        console.log('Fill account data');

                        addActions(() => updateInput(name_code, 'Appodeal client'));

                        addActions(origins.map(function (origin) {
                            return () => updateInput(origins_code, origin, name_code);
                        }));

                        addActions(redirectUris.map(function (uri) {
                            return () => updateInput(redirect_uris_code, uri, name_code);
                        }));

                        addActions(() => {
                            angular.element('button[type=\'submit\']').click();
                            return wait(3000);
                        });
                        addActions(() => {
                            waitUntilClientInfoPresent();
                        });


                        actions.reduce((currentPromise, action) => {
                            return currentPromise.then(action);
                        }, Promise.resolve());

                    } else {
                        name_code = 'angular.element(jQuery("' + ':input[ng-model=\'oAuthEditorCtrl.client.displayName\']")).controller().client.displayName = \'Appodeal client\';';
                        origins_code = 'angular.element(jQuery("ng-form[ng-model=\'oAuthEditorCtrl.client.postMessageOrigins\']")).controller().client.postMessageOrigins = ' + origins + ';';
                        redirect_uris_code = 'angular.element(jQuery("ng-form[ng-model=\'oAuthEditorCtrl.client.redirectUris\']")).controller().client.redirectUris = ' + JSON.stringify(
                            redirectUris) + ';';
                        submit_form_code = 'angular.element(jQuery("form[name=\'clientForm\']")).controller().submitForm();';
                        run_script(name_code + origins_code + redirect_uris_code + submit_form_code);
                        waitUntilClientInfoPresent();
                    }
                }), 3000);
            }), 3000);
        } catch (err) {
            Sentry.captureException(err);
        }
    };
    return {
        init: function () {
            chrome.runtime.sendMessage({type: 'getEnv'}, (env) => {
                environment = env;
                initOtherLibrary('Create and sync credentials.');
                if (isOauthClientPage()) {
                    console.log('Oauth client page');
                    addCredentials();
                } else if (isCredentialClientPage()) {
                    console.log('Reset Credential Secret');
                    resetCredentialSecret();
                } else {
                    console.log('Run credentials processing');
                    credentials_interval = setInterval(waitForCredentials, 5000);
                }
            });
        }
    };
})();

$(document).ready(function () {
    Sentry.withScope(scope => {
        ReportingStepFourController.init();
    });
});
