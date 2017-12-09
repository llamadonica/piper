const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ClosureCompilerPlugin = ClosureCompiler = require('google-closure-compiler-js').webpack;

const mode = process.env.NODE_ENV;

var isProduction  = mode && mode.toUpperCase() === 'PRODUCTION';

const definitions = {};
const plugins = [
  new webpack.DefinePlugin(definitions),
  new CopyWebpackPlugin([
    'src/config.html',
    'src/manifest.json',
    'src/roboto-latin.woff2',
    'src/roboto-latin-bold.woff2',
    'src/sandpiper.svg'
  ])
];

plugins.push();
if (isProduction) {
  plugins.push(new ClosureCompiler({
    options: {
      languageIn: 'ECMASCRIPT_2017',
      languageOut: 'ECMASCRIPT_2017',
      compilationLevel: 'SIMPLE',
      warningLevel: 'VERBOSE',
      externs: [{
        src: `
        const JSCompiler_renameProperty = function(prop, obj) {};
        const HTMLImports = {
          importForElement: function (el) {}
        };
        const ShadyDOM = {
          flush: function () {}
        };
        MutationObserver.prototype.observe = function (target, init) {};
        const chrome = {
          app: {
            runtime: {
              onLaunched: {
                addListener: function (callback) {}
              },
              lastError: 'foo'
            },
            window: {
              create: function (name, options) {}
            }
          },
          sockets: {
            tcp: {
              onReceive: {
                addListener: function (callback) {},
                removeListener: function (callback) {}
              },
              onReceiveError: {
                addListener: function (callback) {},
                removeListener: function (callback) {}
              },
              close: function (socketId, callback) {},
              create: function (options, callback) {},
              setPaused: function (socketId, paused, callback) {},
              connect: function (socketId, remoteHost, remotePort, callback) {},
              send: function (socketId, data, callback) {}

            },
            tcpServer: {
              onAccept: {
                addListener: function (callback) {},
                removeLister: function (callback) {}
              },
              onAcceptError: {
                addListener: function (callback) {},
                removeLister: function (callback) {}
              },
              create: function (options, callback) {},
              listen: function (socketId, hostname, port, callback) {},
              disconnect: function (socketId, callback) {},
              close: function (socketId, callback) {}
            }
          }
        };
        const PortForwardingRule = function () {};`,
        path: '_includes'
      }]
    }
  }));
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

