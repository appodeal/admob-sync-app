import * as Sentry from '@sentry/browser';
import React from 'react';
import ReactDOM from 'react-dom';
import {ClearData} from '../components/clear-data/ClearDataComponent';

import '../style.scss';


ReactDOM.render(<ClearData/>, document.getElementById('content'));

if (environment.sentry && environment.sentry.dsn) {
    Sentry.init(environment.sentry);
}
