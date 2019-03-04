import {css} from 'lib/dom';
import * as React from 'react';
import style from './ProgressBar.scss';


export function ProgressBar ({value}: { value: number }) {
    let totalDeg = value * 360 / 100,
        first, second;
    if (totalDeg <= 180) {
        first = `${Math.max(0, totalDeg)}deg`;
        second = `0deg`;
    } else {
        first = `180deg`;
        second = `${Math.max(0, Math.min(180, totalDeg - 180))}deg`;
    }
    return (
        <div className={style['progress-bar']}>
            <div className={style['progress-bg']}/>
            <div className={style['progress-fill']} style={css({'--first': first, '--second': second})}>
                <div className={style['first']}/>
                <div className={style['second']}/>
            </div>
            <div className={style['progress-info']}>{Math.round(value)}%</div>
        </div>
    );
}
