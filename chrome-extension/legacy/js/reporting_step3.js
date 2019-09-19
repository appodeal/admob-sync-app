var ReportingStepThreeController, modal, consents_interval, email_credentials;
var angular = require('angular');

ReportingStepThreeController = (function () {

    function wait_for_consents () {
        var save_button,
            new_save_button,
            script,
            console_log_code,
            select_save_code,
            name_code,
            set_val_code,
            code;
        try {
            save_button = jQuery('jfk-button[jfk-on-action=\'ctrl.submit()\']');
            new_save_button = jQuery('jfk-button[jfk-on-action=\'ctrl.saveBrandAndRedirect()\']');
            if (save_button.length) {
                clearInterval(consents_interval);
                appendJQuery(function () {
                    script = document.createElement('script');
                    console_log_code = 'console.log(\'Set project name and save\'); ';
                    select_save_code = 'jQuery("jfk-button[jfk-on-action=\'ctrl.submit()\']")';
                    name_code = 'jQuery("[ng-model=\'ctrl.data.displayName\']")';
                    set_val_code = name_code + '.val(\'Appodeal Revenue\');' + 'angular.element(' + name_code + ').triggerHandler(\'input\');';
                    code = console_log_code + set_val_code + 'setTimeout(function() {angular.element(' + select_save_code + ').controller().submit();}, 1000);';
                    script.appendChild(document.createTextNode(code));
                    document.getElementsByTagName('head')[0].appendChild(script);
                    console.log('Save button clicked');

                    goTo4Step(locationProjectName());
                });
            } else if (new_save_button.length) {
                clearInterval(consents_interval);
                appendJQuery(function () {
                    script = document.createElement('script');
                    console_log_code = 'console.log(\'Set project name and save\'); ';
                    element = '[ng-model=\'ctrl.domainInput\']';
                    element2 = '[ng-model=\'ctrl.oauthBrand.displayName\']';
                    select_save_code = 'jQuery("jfk-button[jfk-on-action=\'ctrl.saveBrandAndRedirect()\']")';
                    name_code = 'jQuery("[ng-model=\'ctrl.oauthBrand.displayName\']")';
                    set_val_code = name_code + '.val(\'Appodeal Revenue\');' + 'angular.element(' + name_code + ').triggerHandler(\'input\');';
                    angular.element(element).focus();
                    angular.element(element).val('appodeal.com');
                    angular.element(element)[0].dispatchEvent(new Event('input'));
                    angular.element(element2).focus();
                    code = console_log_code + set_val_code + 'setTimeout(function() {angular.element(' + select_save_code + ').controller().saveBrandAndRedirect();}, 1000);';
                    script.appendChild(document.createTextNode(code));
                    document.getElementsByTagName('head')[0].appendChild(script);
                    console.log('Save button clicked');
                    goTo4Step(locationProjectName());
                });
            }
        } catch (err) {
            Sentry.captureException(err);
        }
    }

    function initOtherLibrary (message) {
        sendOut(0, message);
        appendJQuery(function () {
            modal = new Modal();
            modal.show('Appodeal Chrome Extension', message);
        });
    }

    function goTo4Step (project_name) {
        let int = window.setInterval(function () {
            if (project_name.length) {
                console.log('Find name', project_name);
                clearInterval(int);
                document.location.href = credentialPageUrl(project_name);
            }
        }, 5000);
    }

    return {
        init: function () {
            initOtherLibrary('Saving the consent screen.');
            consents_interval = setInterval(wait_for_consents, 5000);
        }
    };
})();

$(document).ready(function () {
    ReportingStepThreeController.init();
});
