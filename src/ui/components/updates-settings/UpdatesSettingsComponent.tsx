import {action, ActionTypes} from 'lib/actions';
import {classNames, singleEvent} from 'lib/dom';
import {sendToMain} from 'lib/messages';
import {TimePeriod, UpdatePeriod} from 'lib/updates';
import React from 'react';
import style from './UpdatesSettings.scss';


interface UpdateSettingsProps {
    currentVersion: string;
    availableVersion: string;
    lastCheck: string;
    checkPeriod: UpdatePeriod;
    customOptions: {
        value: number,
        interval: TimePeriod
    };
}

export function UpdatesSettings ({currentVersion, availableVersion, lastCheck, checkPeriod, customOptions}: UpdateSettingsProps) {
    let updatePeriod = {
        period: checkPeriod,
        custom: {
            value: customOptions.value,
            interval: customOptions.interval
        }
    };
    return (<div className={classNames(style.settingsForm)}>
        <form onSubmit={e => e.preventDefault()}>
            <label htmlFor="currentVersion">Current version:</label>
            <output id="currentVersion">{currentVersion}</output>
            <label htmlFor="availableVersion">Available version:</label>
            <output id="availableVersion">
                {availableVersion || 'You are already up to date'}
                {
                    !!availableVersion && availableVersion !== currentVersion &&
                    <span className={classNames(style.inlineActions)}>
                        <button type="button" className={classNames('primary')} onClick={singleEvent(downloadDist)}>Download</button>
                        <button type="button" onClick={singleEvent(viewReleaseNotes)}>View release notes</button>
                    </span>
                }
            </output>
            <label htmlFor="lastCheck">Last updates check:</label>
            <output id="lastCheck">
                {getFormattedDateTimeString(lastCheck)}
                <span className={classNames(style.inlineActions)}>
                    <button type="button" onClick={singleEvent(checkForUpdates)}>Check for updates</button>
                </span>
            </output>
            <hr/>
            <label htmlFor="checkPeriod">Perform update checks: </label>
            <select id="checkPeriod" onChange={e => onCheckPeriodChange(e, updatePeriod)} value={checkPeriod}>
                <option value={UpdatePeriod.manual}>Manually</option>
                <option value={UpdatePeriod.daily}>Daily</option>
                <option value={UpdatePeriod.weekly}>Weekly</option>
                <option value={UpdatePeriod.monthly}>Monthly</option>
                <option value={UpdatePeriod.custom}>Custom</option>
            </select>
            {
                checkPeriod === UpdatePeriod.custom &&
                <div className={classNames('actions')}>
                    <label htmlFor="count">Every</label>
                    <input id="count"
                           type="text"
                           defaultValue={customOptions.value.toString()}
                           onKeyDown={e => preventNonDigitKeys(e)}
                           onChange={e => onCustomPeriodValueChange(e, updatePeriod)}
                           pattern={`^\\d+$`}
                           className={classNames(style.periodCount)}
                    />
                    <select value={customOptions.interval} onChange={e => onCustomPeriodIntervalChange(e, updatePeriod)}>
                        <option value={TimePeriod.hour}>Hours</option>
                        <option value={TimePeriod.day}>Days</option>
                        <option value={TimePeriod.week}>Weeks</option>
                        <option value={TimePeriod.month}>Months</option>
                    </select>
                </div>
            }
            <hr/>
            <label htmlFor="clearData">App data: </label>
            <output id="clearData">
                <button type="button" onClick={singleEvent(() => openClearDataDialog())}>Clear All</button>
            </output>
        </form>
    </div>);
}

function openClearDataDialog () {
    return sendToMain('delete-data', action(ActionTypes.showDeleteAllAccountsDataDialog));
}

function preventNonDigitKeys (event: React.KeyboardEvent<HTMLInputElement>) {
    if (!/\d|Backspace|ArrowLeft|ArrowRight|Delete/.test(event.key)) {
        event.preventDefault();
    }
}

function onCustomPeriodIntervalChange (event: React.ChangeEvent<HTMLSelectElement>, updatePeriod) {
    let interval = Number(event.target.value);
    return sendToMain('updates', action(ActionTypes.updatesCheckPeriod, {
        period: updatePeriod.period,
        customOptions: {
            value: updatePeriod.custom.value,
            interval
        }
    }));
}

function onCustomPeriodValueChange (event: React.ChangeEvent<HTMLInputElement>, updatePeriod) {
    let target = event.target,
        value = Math.ceil(Number(target.value.trim()));
    if (Number.isFinite(value) && value > 0 && target.validity.valid) {
        return sendToMain('updates', action(ActionTypes.updatesCheckPeriod, {
            period: updatePeriod.period,
            customOptions: {
                value,
                interval: updatePeriod.custom.interval
            }
        }));
    }
}

function onCheckPeriodChange (event: React.ChangeEvent<HTMLSelectElement>, updatePeriod) {
    let period = Number(event.target.value);
    return sendToMain('updates', action(ActionTypes.updatesCheckPeriod, {
        period,
        customOptions: {
            value: updatePeriod.custom.value,
            interval: updatePeriod.custom.interval
        }
    }));
}

function getFormattedDateTimeString (isoDateString): string {
    let date = new Date(isoDateString),
        locale = 'ru-RU';
    return `${date.toLocaleDateString(locale)} ${date.toLocaleTimeString(locale)}`;
}

function downloadDist () {
    return sendToMain('updates', action(ActionTypes.downloadDist));
}

function viewReleaseNotes () {
    return sendToMain('updates', action(ActionTypes.viewReleaseNotes));
}

function checkForUpdates () {
    return sendToMain('updates', action(ActionTypes.checkUpdates, {
        mode: 'modal',
        updateOnly: false
    }));
}
