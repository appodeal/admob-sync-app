import path from 'path';
import webpack from 'webpack';
import merge from 'webpack-merge';
import {entriesConfig, SRC_PATH} from './default';
import {environment} from './plugins/environment';


let envConfig = require(path.join(SRC_PATH, '../config/development.json'));

export default entriesConfig.map(entry => (env: webpack.Configuration): webpack.Configuration => {
        return merge(entry(env), {
            mode: 'development',
            plugins: [
                environment(env, envConfig, {
                    development: true,
                    settingsPage: './settings.html'
                })
            ]
        });
    }
);
