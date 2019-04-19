import React from "react";
import style from "./About.scss";
import {sendToMain} from "lib/messages";
import {action, ActionTypes} from "lib/actions";

interface AboutProps {
    packageInfo: any
}

export function About({packageInfo}: AboutProps) {
    let yearStart = 2019,
        yearEnd = new Date().getFullYear();
    return (<div className={style.about}>
        <img className={style.logo} src={require('ui/assets/images/logo-red.svg')} alt="Appodeal" draggable={false}/>
        <p className={style.name}>{packageInfo.productName}</p>
        <p className={style.version}>Version: {packageInfo.version}</p>
        <p className={style.copyright}>
            Copyright &copy; {yearStart === yearEnd ? yearEnd : `${yearStart} - ${yearEnd}`}, {typeof packageInfo.author === 'object' ?
            packageInfo.author.name :
            packageInfo.author}
        </p>
        <p className={style.links}>
            <a href='#' onClick={event => {
                event.preventDefault();
                sendToMain('about', action(ActionTypes.openPrivacyPolicy)).then(() => window.close())
            }}>Privacy Policy</a>
        </p>
    </div>)
}
