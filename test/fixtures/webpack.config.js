/**
 * Test and develop a widget by running the following at the root of the git checkout:
 *
 *    bin/webpack-serve --config test/fixtures/projects/webpack.config.js
 *
 * It will build and serve the demo code with live-reload at
 *
 *    http://localhost:9000/
 */
'use strict';

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const glob = require('glob');
const path = require('path');

// Build each */index.ts as its own bundle.
const entries = {};
for (const fixture of glob.sync(`${__dirname}/*/index.ts`)) {
  entries[path.basename(path.dirname(fixture))] = fixture;
}

module.exports = {
  mode: "development",
  entry: entries,
  output: {
    path: path.resolve(__dirname),
    filename: "build/[name].bundle.js",
    sourceMapFilename: "build/[name].bundle.js.map",
  },
  devtool: 'inline-source-map',
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    modules: [
      path.resolve('.'),
      path.resolve('./node_modules')
    ],
  },
  module: {
    rules: [
      { test: /\.tsx?$/,
        exclude: /node_modules/,
        include: [path.resolve("./lib"), path.resolve('./test')],
        use: [
          { loader: 'cache-loader' },
          { loader: 'ts-loader',
            options: {
              happyPackMode: true,  // see https://medium.com/webpack/typescript-webpack-super-pursuit-mode-83cc568dea79
              transpileOnly: true,  // disable type checker - we will use it in fork plugin
              experimentalWatchApi: true,
            }
          },
        ]
      }
    ]
  },
  plugins: [
    // see https://medium.com/webpack/typescript-webpack-super-pursuit-mode-83cc568dea79
    new ForkTsCheckerWebpackPlugin({ checkSyntacticErrors: true })
  ],
  devServer: {
    contentBase: [path.resolve(__dirname)],
    port: 9000,
    open: true,

    // Serve a trivial little index page.
    before: (app, server) => {
      app.get('/', (req, res) => {
        const body = Object.keys(entries).map((e) => `<a href="${e}/">${e}</a><br>\n`).join('');
        res.send(`<html><body>${body}</body></html>`);
      });
    },
  }
};
