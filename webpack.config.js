const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ClosureCompilerPlugin = require('webpack-closure-compiler');

const mode = process.env.NODE_ENV;

var isProduction  = mode && mode.toUpperCase() === 'PRODUCTION';

const definitions = {};
const plugins = [
  new webpack.DefinePlugin(definitions),
  new CopyWebpackPlugin([
    'src/config.html',
    'src/manifest.json'
  ])
];

plugins.push();
if (isProduction) {

}


var filename = '[name]' + (isProduction ? '.min' : '') + '.js'
var entries = {
  background: './src/background.js',
  config: './src/config.js'
};

module.exports = {
    entry: entries,
    devtool: 'source-map',
    output: {
      filename: filename,
      path: __dirname + '/dist/default',
      sourceMapFilename: '[file].map'
    },
    module: {
      rules: []
    },
    plugins: plugins
  };

