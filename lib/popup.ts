import {dom} from 'grainjs';
import Popper from 'popper.js';

export interface IDOMContent {
  getDOM: (callbacks: { close: () => void, update: () => void }) => HTMLElement;
}

function close() {
  // tslint:disable-next-line:no-console
  console.warn('close');
}
function update() {
  // tslint:disable-next-line:no-console
  console.warn('update');
}

export function popup(reference: Element, content: IDOMContent) {
  const el = content.getDOM({close, update});
  reference.insertAdjacentElement('afterend', el);
  // tslint:disable-next-line:no-unused-expression
  new Popper(reference, el);
}

export function tooltip(reference: Element, text: string) {
  const elem = dom('div.weasel_tooltip', {style: 'border: 1px solid blue'}, '[Tooltip] ', text);
  reference.insertAdjacentElement('afterend', elem);
  return new Popper(reference, elem);
}
