import HtmlWebpackPlugin from 'html-webpack-plugin';
import CSSExtractPlugin from 'mini-css-extract-plugin';
import ScriptExtHtmlWebpackPlugin from 'script-ext-html-webpack-plugin';
import * as path from 'path';
import webpack from 'webpack';
import {SRC_PATH} from "../default";

export default (env: webpack.Configuration): webpack.Configuration => {
    return {
        context: SRC_PATH,
        entry: {
            'accounts': path.join(SRC_PATH, './ui/manage-accounts/manage-accounts.tsx')
        },
        target: 'electron-renderer',
        plugins: [
            new HtmlWebpackPlugin({
                hash: true,
                template: path.join(SRC_PATH, './ui/manage-accounts/manage-accounts.ejs'),
                chunks: ['accounts'],
                inject: 'head',
                filename: 'manage-accounts.html'
            }),
            new ScriptExtHtmlWebpackPlugin({
                defaultAttribute: 'defer'
            }),
            new CSSExtractPlugin({
                filename: 'assets/[name].css'
            }),
        ]
    };
}
