import {assert, driver, useServer, WebElement, WebElementPromise} from 'mocha-webdriver';
import {server} from '../fixtures/webpack-test-server';

// tslint:disable-next-line:no-var-requires
const command = require('selenium-webdriver/lib/command');

class WebElementRect implements ClientRect {
  constructor(public readonly rect: {width: number, height: number, x: number, y: number}) {}
  get width(): number { return this.rect.width; }
  get height(): number { return this.rect.height; }
  get top(): number { return this.rect.y; }
  get bottom(): number { return this.rect.y + this.rect.height; }
  get left(): number { return this.rect.x; }
  get right(): number { return this.rect.x + this.rect.width; }
}

Object.assign(WebElement.prototype, {
  async rect(this: WebElement): Promise<ClientRect> {
    return new WebElementRect(await this.getRect());
  },
  // As of 4.0.0-alpha.1, selenium-webdriver mistakenly swallows errors in getRect(), override
  // here to fix that. TODO: This is strictly temporary until fixed in selenium-webdriver.
  async getRect() {
    return await (this as any).execute_(
      new command.Command(command.Name.GET_ELEMENT_RECT));
  },
  mouseMove(this: WebElement, params: {x?: number, y?: number} = {}): WebElementPromise {
    // Unfortunately selenium-webdriver typings at this point (Nov'18) are a major version behind.
    const actions = this.getDriver().actions() as any;
    const p = actions.move({origin: this, ...params}).perform();
    return new WebElementPromise(this.getDriver(), p.then(() => this));
  },
});

declare module "selenium-webdriver" {
  interface WebElement {    // tslint:disable-line:interface-name
    rect(): ClientRect;
    getRect(): Promise<{width: number, height: number, x: number, y: number}>;
    mouseMove(params?: {x?: number, y?: number}): WebElementPromise;
  }
}

type RelPos = 'above'|'below'|'leftOf'|'rightOf';
async function assertPosition(a: WebElement, b: WebElement, rel: RelPos, delta: number): Promise<void> {
  const ar: ClientRect = await a.rect();
  const br: ClientRect = await b.rect();
  switch (rel) {
    case 'above': return assert.closeTo(ar.bottom, br.top, delta);
    case 'below': return assert.closeTo(ar.top, br.bottom, delta);
    case 'leftOf': return assert.closeTo(ar.right, br.left, delta);
    case 'rightOf': return assert.closeTo(ar.left, br.right, delta);
  }
}

describe('popper', () => {
  useServer(server);

  before(async function() {
    this.timeout(60000);      // Set a longer default timeout.
    await driver.get(`${server.getHost()}/tooltip/`);
  });

  it('should normally position relative to window', async function() {
    this.timeout(20000);
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const button = await driver.findContent('.test-top button', new RegExp(`Body ${side}`)).mouseMove();
      await driver.sleep(10);
      await assertPosition(driver.findContent('div', /body top/), button, 'above', 20);
      await assertPosition(driver.findContent('div', /body right/), button, 'rightOf', 20);
      await assertPosition(driver.findContent('div', /body bottom/), button, 'below', 20);
      await assertPosition(driver.findContent('div', /body left/), button, 'leftOf', 20);
    }
  });

  it('should position relative to an element if requested', async function() {
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const button = await driver.findContent('.test-top button', new RegExp(`Parent ${side}`)).mouseMove();
      await driver.sleep(10);
      await assertPosition(driver.findContent('div', /parent top/), button,
        side === 'Top' ? 'below' : 'above', 20);
      await assertPosition(driver.findContent('div', /parent right/), button,
        side === 'Right' ? 'leftOf' : 'rightOf', 20);
      await assertPosition(driver.findContent('div', /parent bottom/), button,
        side === 'Bottom' ? 'above' : 'below', 20);
      await assertPosition(driver.findContent('div', /parent left/), button,
        side === 'Left' ? 'rightOf' : 'leftOf', 20);
    }
  });
});
