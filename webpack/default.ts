import CSSExtractPlugin from 'mini-css-extract-plugin';
import * as path from 'path';
import webpack from 'webpack';
import merge from 'webpack-merge';
import about from './entries/about';
import accounts from './entries/accounts';
import chromeExtension from './entries/chrome-ext';
import clearData from './entries/clear-data';

import main from './entries/main';
import preload from './entries/preload';
import settings from './entries/settings';
import signIn from './entries/sign-in';


export const SRC_PATH = path.resolve(__dirname, '../src');
export const BUILD_PATH = path.resolve(__dirname, '../build/app');
export const PACKAGE = require(path.join(__dirname, '../package.json'));


const entries = process.argv.includes('--chrome-ext')
    ? [chromeExtension]
    : [main, settings, signIn, accounts, about, clearData, preload];

export const entriesConfig = entries.map(
    entry => (env: webpack.Configuration): webpack.Configuration => {
        return merge({
            output: {
                path: BUILD_PATH,
                filename: '[name].js'
            },
            devtool: 'source-map',
            module: {
                rules: [
                    {
                        test: /\.ts|\.tsx$/,
                        use: ['ts-loader']
                    },
                    {
                        test: /\.(png|svg)$/i,
                        use: [
                            {
                                loader: '@brigad/ideal-image-loader',
                                options: {
                                    webp: false,
                                    base64: false,
                                    palette: false,
                                    warnOnMissingSrcset: true,
                                    name: '[name].[ext]',
                                    publicPath: './assets/images',
                                    outputPath: './assets/images'
                                }
                            }
                        ]
                    },
                    {
                        test: /\.(woff2|ttf|eot)$/,
                        use: [
                            {
                                loader: 'file-loader',
                                options: {
                                    name: '[name].[ext]',
                                    publicPath: './fonts',
                                    outputPath: './assets/fonts'
                                }
                            }
                        ]
                    },
                    {
                        test: /\.ico$/,
                        use: [
                            {
                                loader: 'file-loader',
                                options: {
                                    name: '[name].[ext]',
                                    publicPath: './assets/images',
                                    outputPath: './assets/images'
                                }
                            }
                        ]
                    },
                    {
                        test: /\.scss$/, use: [
                            CSSExtractPlugin.loader,
                            {
                                loader: 'css-loader',
                                options: {
                                    modules: true,
                                    sourceMap: true
                                }
                            },
                            {
                                loader: 'sass-loader',
                                options: {
                                    sourceMap: true
                                }
                            }
                        ]
                    },
                    {
                        test: /\.(graphql|gql)$/,
                        exclude: /node_modules/,
                        loader: 'graphql-tag/loader'
                    }
                ]
            },
            resolve: {
                extensions: ['.tsx', '.json', '.ts', '.js', '.svg'],
                modules: [
                    'node_modules',
                    '@typings',
                    path.resolve(__dirname, '../src')
                ]
            }
        }, entry(env));
    });
