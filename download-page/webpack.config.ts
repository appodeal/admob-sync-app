import CopyPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import * as path from 'path';
import webpack from 'webpack';
// @ts-ignore
import * as dist from '../dist/app/dist-info.json';


export const SRC_PATH = path.resolve(__dirname, './src');
export const NGINX_PATH = path.resolve(__dirname, './nginx');

export const BUILD_PATH = path.resolve(__dirname, '..', 'dist');

export default (env: webpack.Configuration): webpack.Configuration => {
    return {
        context: __dirname,
        target: 'web',
        entry: path.resolve(SRC_PATH, 'index.js'),
        output: {
            path: BUILD_PATH,
            filename: 'html/main.js'
        },
        module: {
            rules: [
                {
                    test: /\.(ejs)$/,
                    use: [
                        {
                            loader: 'ejs-webpack-loader',
                            options: {
                                data: {dist},
                                htmlmin: false
                            }
                        }
                    ]

                },
                {
                    test: /\.(css|scss)$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        'css-loader',
                        'sass-loader'
                    ]
                }
            ],
        },
        plugins: [
            new MiniCssExtractPlugin({filename: 'html/style.css'}),
            new HtmlWebpackPlugin({
                template: path.join(SRC_PATH, 'index.ejs'),
                filename: 'html/index.html',
                htmlmin: true,
                inject: true
            }),
            new HtmlWebpackPlugin({
                hash: false,
                inject: false,
                template: path.join(NGINX_PATH, 'nginx.conf.ejs'),
                filename: 'nginx/nginx.conf'
            }),
            new CopyPlugin([
                {
                    from: path.join(SRC_PATH + '/images'),
                    to: 'html/images/'
                }
            ])
        ]
    };
}
