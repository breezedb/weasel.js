/**
 * This tests our tooltip implementation.
 */
// tslint:disable:no-console

import {dom, makeTestId, styled, TestId} from 'grainjs';
import {menu, MenuItem, menuItem, menuItemSubmenu} from '../../../lib/menu';

document.addEventListener('DOMContentLoaded', () => {
  document.body.appendChild(setupTest());
});

const testId: TestId = makeTestId('test-');

function setupTest() {
  // Create a rectangle, with a button along each edge. Each botton will have 4
  // differently-positioned tooltps, and we'll check that hovering over each one causes 1 tooltip
  // to flip. We'll also include a body-attached tooltip which should overhang the box.
  return cssExample(testId('top'),
    dom('button', 'My Menu', menu(makeMenu)),
  );
}

function makeMenu(): MenuItem[] {
  console.log("makeMenu");
  return [
    menuItem(() => { console.log("Menu item: Cut"); }, "Cut"),
    menuItemSubmenu(makePasteSubmenu, "Paste Special"),
    menuItem(() => { console.log("Menu item: Copy"); }, "Copy"),
    menuItem(() => { console.log("Menu item: Paste"); }, "Paste"),
    menuItemSubmenu(makePasteSubmenu, "Paste Special"),
  ];
}

function makePasteSubmenu(): MenuItem[] {
  console.log("makePasteSubmenu");
  return [
    menuItem(() => { console.log("Menu item: Cut2"); }, "Cut2"),
    menuItem(() => { console.log("Menu item: Copy2"); }, "Copy2"),
    menuItem(() => { console.log("Menu item: Paste2"); }, "Paste2"),
    menuItemSubmenu(makePasteSubmenu, "Paste Special2"),
  ];
}

const cssExample = styled('div', `
  position: relative;
  overflow: auto;
  margin-left: 250px;
  margin-top: 50px;
  background-color: grey;
  color: white;
  font-size: 100%;
  font-family: sans-serif;
  vertical-align: baseline;
  height: 300px;
  width: 500px;

  & button {
    display: block;
    white-space: nowrap;
  }
`);
