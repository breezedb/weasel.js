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
