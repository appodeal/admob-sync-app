import {classNames} from 'lib/dom';
import * as React from 'react';
import style from './ProgressBar.scss';


export function ProgressBar ({value, status}: { value: number, status: 'pending' | 'progress' }) {
    return (
        <div className={classNames(style.progressBar, {[style.pending]: status === 'pending', [style.progress]: status === 'progress'})}>
            <div className={style.line} style={{width: `${value}%`}} />
        </div>
    );
}
