import {Disposable, dom, DomElementMethod, Holder} from 'grainjs';
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

export function tooltip(reference: Element, text: string): void {
  const elem = dom('div', {style: 'border: 1px solid blue'}, text);
  popupElem(reference, elem);
}
*/

/**
 * TODO document
 * Note: should emit 'close' event when the popup is closed.
 */
export interface IPopupControl { // extends EventEmitter {
  close: () => void;
  update: () => void;   // repositions?
}

type Trigger  = 'click' | 'hover' | 'focus';

interface IPopupOptions {
  placement?: Popper.Placement; // As for Popper options, e.g. "top", "bottom-end" or "right-start".
  delay?: number | {show: number, hide: number};
  trigger?: Trigger[];          // On what events the tooltip is triggered.
  offset?: number|string;       // Offset releative to reference, as in Popper's modifiers~offset.
  boundariesElement?: Popper.Boundary|Element;  // Element used as boundaries for the tooltip.
  popperOptions?: Popper.PopperOptions;
}

interface ITooltipOptions extends IPopupOptions {
  content?: DomElementMethod;   // If omitted, will use "title" attribute.
  container?: Element|null;     // Where to append tooltip content to; null means referenceElem.parentNode
}

const defaultTooltipOptions: ITooltipOptions = {
  placement: 'top',
  container: null,
  delay: 0,
  trigger: ['hover', 'focus'],
  offset: 0,
};

/**
 * Usage:
 *    dom('div', {title: "Hello"}, tooltip())
 *    dom('div', tooltip({content: () => dom('b', 'World'), placement: 'bottom'}))
 * It roughly replicates Popper's tooltip feautres from https://popper.js.org/tooltip-documentation.html
 */
export function tooltip(options?: ITooltipOptions): DomElementMethod {
  return (elem) => tooltipElem(elem, options);
}
export function tooltipElem(referenceElem: Element, options?: ITooltipOptions): void {
  // Handling options:
  //  placement, offset, boundariesElement, popperOptions: all passed to Popper.
  //  OK content: determines the tooltip content.
  //  container: determines where the tooltip's constructed DOM gets attached. -- h
  //  delay: determines the delay when reacting to events.
  //  trigger: determines which events to listen to.
  const opts = {...defaultTooltipOptions, ...options};

  function openFunc(): IPopupOpen {
    let arrowElement: Element;
    const content = dom('div.tooltip', {role: 'tooltip'},
      arrowElement = dom('div.tooltip-arrow'),
      dom('div.tooltip-inner', opts.content || referenceElem.getAttribute('title')));

    const containerElem = opts.container || referenceElem.parentNode!;
    containerElem.appendChild(content);

    function dispose() {
      detach(content);
      dom.domDispose(content);
    }
    return {content, dispose, arrowElement};
  }
  Popup.initialize(referenceElem, openFunc, opts);
}

export interface IPopupOpen {
  content: Element;
  arrowElement?: Element;
  dispose: () => void;
}

function detach(node: Node): void {
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

// function noop() { /* noop */ }

/**
 * This represents a single instance of the OPEN popup. An instance of Popup is created to show
 * the popup, and gets disposed to hide it.
 */
class Popup extends Disposable implements IPopupControl {
  public static initialize(referenceElem: Element, openFunc: () => IPopupOpen, options: IPopupOptions) {
    const popperOptions: Popper.PopperOptions = {
      ...options.popperOptions,
      placement: options.placement,
    };
    popperOptions.modifiers = {
      ...popperOptions.modifiers,
      offset: { offset: options.offset },
      preventOverflow: { boundariesElement: options.boundariesElement },
    };

    const holder = new Holder<Popup>();
    dom.autoDisposeElem(referenceElem, holder);   // Close on disposal of referenceElem.

    function open() { Popup.create(holder, referenceElem, openFunc, options); }
    function close() { holder.clear(); }
    function toggle() { holder.isEmpty() ? open() : close(); }

    if (options.trigger) {
      for (const trigger of options.trigger) {
        switch (trigger) {
          case 'click':
            dom.onElem(referenceElem, 'click', toggle);
            break;
          case 'focus':
            dom.onElem(referenceElem, 'focus', open);
            dom.onElem(referenceElem, 'blur', close);
            break;
          case 'hover':
            dom.onElem(referenceElem, 'mouseenter', open);
            // TODO not quite right: don't want to close if moved mouse over the tooltip.
            dom.onElem(referenceElem, 'mouseleave', close);
            break;
        }
      }
    }
  }

  private _popper: Popper;

  constructor(triggerElem: Element, openFunc: () => IPopupOpen, options: Popper.PopperOptions) {
    super();

    // Once Popup is disposed, unset all fields for easier detection of bugs.
    this.wipeOnDispose();

    const {content, dispose, arrowElement} = openFunc();
    this.onDispose(dispose);

    if (options && options.modifiers) {
      options.modifiers.arrow = {element: arrowElement};
    }

    this._popper = new Popper(triggerElem, content, options);
    this.onDispose(() => this._popper.destroy());

    // On click anywhere on the page (outside triggerElem or popup content), close it.
    this.autoDispose(dom.onElem(document, 'click', (evt) => {
      const target: Node|null = evt.target as Node;
      if (target && !content.contains(target) && !triggerElem.contains(target)) {
        this.dispose();
      }
    }, {useCapture: true}));
  }

  public close() { this.dispose(); }

  public update() { this._popper.scheduleUpdate(); }
}

/*
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
*/
