import {Disposable, dom, Holder, IDisposable} from 'grainjs';
import Popper from 'popper.js';

export interface IDOMContent {
  getDOM: (callbacks: { close: () => void, update: () => void }) => HTMLElement;
}
/*

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
*/

export function tooltip(reference: Element, text: string): void {
  const elem = dom('div', {style: 'border: 1px solid blue'}, text);
  popupElem(reference, elem);
}

/**
 * TODO document
 * Note: should emit 'close' event when the popup is closed.
 */
export interface IPopupControl { // extends EventEmitter {
  close: () => void;
  update: () => void;   // repositions?
}

export type DisposeFunc = () => void;
export type PopupFunc = (elem: Element, ctl: IPopupControl) => DisposeFunc;

function detach(node: Node): void {
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

function noop() { /* noop */ }

/**
 * This represents a single instance of the OPEN popup. An instance of Popup is created to show
 * the popup, and gets disposed to hide it.
 */
class Popup extends Disposable implements IPopupControl {
  private _popper: Popper;

  constructor(triggerElem: Element, func: PopupFunc, options?: Popper.PopperOptions) {
    super();

    // Once Popup is disposed, unset all fields for easier detection of bugs.
    this.wipeOnDispose();

    const popupContainer = dom('div');
    const dispose = func(popupContainer, this);
    this.onDispose(dispose);

    triggerElem.parentNode!.appendChild(popupContainer);
    this.onDispose(() => detach(popupContainer));

    this._popper = new Popper(triggerElem, popupContainer, options);
    this.onDispose(() => this._popper.destroy());

    // On click anywhere on the page (outside triggerElem or popup content), close it.
    this.autoDispose(dom.onElem(document, 'click', (evt) => {
      const target: Node|null = evt.target as Node;
      if (target && !popupContainer.contains(target) && !triggerElem.contains(target)) {
        this.dispose();
      }
    }, {useCapture: true}));
  }

  public close() { this.dispose(); }

  public update() { this._popper.scheduleUpdate(); }
}

// func is called with a new div as elem; can add content to this div. No need to remove content.
export function popupFunc(triggerElem: Element, func: PopupFunc, options?: Popper.PopperOptions): IDisposable {
  const holder = new Holder<Popup>();

  // If triggerElem gets disposed, make sure to close the associated popup if any.
  dom.autoDisposeElem(triggerElem, holder);

  // TriggerElem itself serves as a toggle for the popup.
  return dom.onElem(triggerElem, 'click', (event) =>
    holder.isEmpty() ? Popup.create(holder, triggerElem, func, options) : holder.clear());
}

export function popupElem(triggerElem: Element, content: Element, options?: Popper.PopperOptions): void {
  popupFunc(triggerElem, (elem) => { elem.appendChild(content); return noop; }, options);
}
