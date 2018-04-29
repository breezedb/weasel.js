import {assert, driver} from './util';

describe('Basic', () => {
  before(async function() {
    this.timeout(20000);      // Set a longer default timeout.
    await driver.get('http://localhost:8080/basic.html');
  });

  it('should find element', async () => {
    // TODO READ RECOMMENDATIONS AT
    // https://wiki.saucelabs.com/display/DOCS/Best+Practices+for+Running+Tests
    assert.equal(await driver.find('#popup').getText(), 'Popup (0)');
    await driver.find('#popup').click();
    assert.equal(await driver.find('#popup').getText(), 'Popup (1)');
  });

  it('should open tooltip', async () => {
    await driver.findWait('#tooltip').click();
    assert.equal(await driver.findWait('.weasel_tooltip').getText(), '[Tooltip] Hello');
  });
});
