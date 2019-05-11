import HtmlWebpackPlugin from 'html-webpack-plugin';
import CSSExtractPlugin from 'mini-css-extract-plugin';
import * as path from 'path';
import ScriptExtHtmlWebpackPlugin from 'script-ext-html-webpack-plugin';
import webpack from 'webpack';
import {SRC_PATH} from '../default';


export default (env: webpack.Configuration): webpack.Configuration => {
    return {
        context: SRC_PATH,
        entry: {
            'clear-data': path.join(SRC_PATH, './ui/clear-data/clear-data.tsx')
        },
        target: 'electron-renderer',
        plugins: [
            new HtmlWebpackPlugin({
                hash: true,
                template: path.join(SRC_PATH, './ui/clear-data/clear-data.ejs'),
                chunks: ['clear-data'],
                inject: 'head',
                filename: 'clear-data.html'
            }),
            new ScriptExtHtmlWebpackPlugin({
                defaultAttribute: 'defer'
            }),
            new CSSExtractPlugin({
                filename: 'assets/[name].css'
            })
        ]
    };
}
