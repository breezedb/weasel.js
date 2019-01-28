/**
 * This tests our tooltip implementation.
 */
// tslint:disable:no-console
import {dom, DomElementArg, obsArray, observable, makeTestId, styled, TestId} from 'grainjs';
import {cssMenuDivider, menu, menuItem, menuItemSubmenu} from '../../../lib/menu';

document.addEventListener('DOMContentLoaded', () => {
  document.body.appendChild(setupTest());
});

const testId: TestId = makeTestId('test-');

const hideCut = observable(false);
const pasteList = obsArray(['Paste 1']);
let pasteCount: number = 1;

function setupTest() {
  // Create a rectangle, with a button along each edge. Each botton will have 4
  // differently-positioned tooltps, and we'll check that hovering over each one causes 1 tooltip
  // to flip. We'll also include a body-attached tooltip which should overhang the box.
  return cssExample(testId('top'),
    dom('button', 'My Menu', menu(makeMenu)),
  );
}

function makeMenu(): DomElementArg[] {
  console.log("makeMenu");
  return [
    menuItem(() => { console.log("Menu item: Cut"); }, "Cut", dom.hide(hideCut)),
    menuItemSubmenu(makePasteSubmenu, "Paste Special"),
    menuItem(() => { console.log("Menu item: Copy"); }, "Copy"),
    menuItem(() => {
      console.log("Menu item: Paste");
      pasteList.push(`Paste ${++pasteCount}`);
    }, "Paste"),
    cssMenuDivider(),
    dom.forEach(pasteList, str =>
      menuItem(() => { console.log(`Menu item: ${str}`); }, str)
    ),
    cssMenuDivider(),
    menuItem(() => {
      hideCut.set(!hideCut.get());
      console.log("Menu item: Show/Hide Cut");
    }, dom.text((use) => use(hideCut) ? "Show Cut" : "Hide Cut")),
    cssMenuDivider(),
    menuItemSubmenu(makePasteSubmenu, "Paste Special"),
  ];
}

function makePasteSubmenu(): DomElementArg[] {
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
