import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as http from 'http';
import {Server} from 'node-static';
import * as path from 'path';
import * as webdriver from 'selenium-webdriver';
import {By, logging, ThenableWebDriver, until, WebDriver, WebElementPromise} from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';
import * as firefox from 'selenium-webdriver/firefox';

// tslint:disable:no-console

chai.use(chaiAsPromised);

/**
 * By using `import {assert} from './util', you can be sure that it includes chai-as-promised.
 */
export {assert} from 'chai';

export let driver: IWebDriverPlus;

// Path for the static files that we serve to the browser that the webdriver starts up.
const staticPath = path.join(path.dirname(__dirname), 'static');

// Command-line option for whether to keep browser open if a test fails. Note that it needs to be
// passed after arguments listing test names, otherwise mocha will reject it.
const noexit: boolean = (process.argv.indexOf("--noexit") !== -1);

/**
 * Enhanced WebDriver interface.
 */
export interface IWebDriverPlus extends ThenableWebDriver {
  /**
   * Shorthand to find element by css selector.
   */
  find(selector: string): WebElementPromise;

  /**
   * Shorthand to wait for an element to be present, using a css selector.
   */
  findWait(selector: string, timeout?: number, message?: string): WebElementPromise;
}

// Implementation of the enhanced WebDriver interface.
const WebDriverProto = WebDriver.prototype as IWebDriverPlus;
WebDriverProto.find = function(selector: string) {
  return this.findElement(By.css(selector));
};

WebDriverProto.findWait = function(selector: string, timeout?: number, message?: string) {
  return this.wait(until.elementLocated(By.css(selector)), timeout, message);
};

let httpServer: http.Server;

// Start up the webdriver and serve files that its browser will see.
before(async function() {
  this.timeout(20000);      // Set a longer default timeout.

  const logPrefs = new logging.Preferences();
  logPrefs.setLevel(logging.Type.BROWSER, logging.Level.INFO);

  driver = new webdriver.Builder()
    .forBrowser('firefox')
    .setLoggingPrefs(logPrefs)
    .setChromeOptions(new chrome.Options())
    .setFirefoxOptions(new firefox.Options())
    .build() as IWebDriverPlus;

  const staticServer = new Server(staticPath);
  httpServer = http.createServer((req, resp) => {
    req.addListener('end', () => staticServer.serve(req, resp));
    req.resume();
  });
  httpServer.listen(8080);
});

// Quit the webdriver and stop serving files, unless we failed and --noexit is given.
after(async function() {
  this.timeout(20000);      // Set a longer default timeout.
  let countFailed = 0;
  this.test.parent.eachTest((test: any) => { countFailed += test.state === 'failed' ? 1 : 0; });
  if (countFailed > 0 && noexit) {
    // Continue running indefinitely by keeping server and webdriver running.
    console.log("Not exiting. Abort with Ctrl-C");
  } else {
    if (httpServer) { httpServer.close(); }
    if (driver) { await driver.quit(); }
  }
});
