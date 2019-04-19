import CSSExtractPlugin from 'mini-css-extract-plugin';
import * as path from 'path';
import webpack from 'webpack';
import merge from 'webpack-merge';

import main from './entries/main';
import settings from './entries/settings';
import signIn from './entries/sign-in';
import accounts from './entries/accounts';
import about from './entries/about';

export const SRC_PATH = path.resolve(__dirname, '../src');
export const BUILD_PATH = path.resolve(__dirname, '../build');
export const PACKAGE = require(path.join(__dirname, '../package.json'));

export const entries = [main, settings, signIn, accounts, about].map(entry => (env: webpack.Configuration): webpack.Configuration => {
    return merge(entry(env), {
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
    });
});
