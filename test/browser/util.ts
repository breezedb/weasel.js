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

export {assert} from 'chai';

export interface IWebDriverPlus extends ThenableWebDriver {
  find(selector: string): WebElementPromise;
  findWait(selector: string, timeout?: number, message?: string): WebElementPromise;
}

const WebDriverProto = WebDriver.prototype as IWebDriverPlus;
WebDriverProto.find = function(selector: string) {
  return this.findElement(By.css(selector));
};

WebDriverProto.findWait = function(selector: string, timeout?: number, message?: string) {
  return this.wait(until.elementLocated(By.css(selector)), timeout, message);
};

const staticPath = path.join(path.dirname(__dirname), 'static');

export let driver: IWebDriverPlus;
let httpServer: http.Server;

const noexit: boolean = (process.argv.indexOf("--noexit") !== -1);

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
