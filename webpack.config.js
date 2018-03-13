const path = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    //devtool: 'eval',
    plugins: [
        new UglifyJsPlugin({
            //sourceMap: true
        }),
        new HtmlWebpackPlugin({
            template: './demo/index.html',
            inject: 'head'
        })
    ]
};