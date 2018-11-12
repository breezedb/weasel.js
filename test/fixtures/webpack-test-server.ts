import {IMochaServer} from 'mocha-webdriver';
import * as path from 'path';
import * as merge from 'webpack-merge';
import * as serve from 'webpack-serve';

// tslint:disable:no-console

// TODO: It should be nice to switch here to webpack-dev-server, as for manual running, but that
// one does not work properly out of the box (in this context), whereas webpack-serve does.
export class WebpackServer implements IMochaServer {
  // The result of webpack-serve call. See https://github.com/webpack-contrib/webpack-serve#serveargv-options
  private _server: any;

  public async start() {
    const config = require(path.resolve(__dirname, 'webpack.config.js'));
    console.log("Starting webpack-serve");
    this._server = await serve({}, {
      config: merge(config, {
        serve: {
          content: [path.resolve(__dirname)],
          port: 9010,
          open: false,
          clipboard: false,
          hotClient: false,
          logLevel: 'warn',
        },
      }),
    });
  }

  public async stop() {
    console.log("Stopping webpack-serve");
    this._server.app.stop();
  }

  public getHost(): string {
    const {app, options} = this._server;
    const {port} = app.server.address();
    return `${options.protocol}://${options.host}:${port}`;
  }
}

export const server = new WebpackServer();
