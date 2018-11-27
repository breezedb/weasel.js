import {Disposable, dom, domDispose, Holder, IDisposable} from 'grainjs';
import defaultsDeep = require('lodash/defaultsDeep');
import noop = require('lodash/noop');
import Popper from 'popper.js';

/**
 * On what event the trigger element opens the popup. E.g. 'hover' is suitable for a tooltip,
 * while 'click' is suitable for a dropdown menu.
 */
type Trigger  = 'click' | 'hover' | 'focus';

/**
 * Options available to setPopup* methods.
 */
export interface IPopupOptions {
  // Placement of popup, as for Popper options, e.g. "top", "bottom-end" or "right-start".
  placement?: Popper.Placement;

  // To which element to append the popup content. Null means triggerElem.parentNode and is the
  // default; string is a selector for the closest matching ancestor of triggerElem, e.g. 'body'.
  attach?: Element|string|null;

  // Boundaries for the placement of the popup. The default is 'viewport'. This determines the
  // values of modifiers.flip.boundariesElement and modifiers.preventOverflow.boundariesElement.
  // Use null to use the defaults from popper.js. These may be set individually via modifiers.
  boundaries?: Element|'scrollParent'|'window'|'viewport'|null;

  // On what events, the popup is triggered.
  trigger?: Trigger[];

  showDelay?: number;       // Default delay to show the popup. Defaults to 0.
  hideDelay?: number;       // Default delay to hide the popup. Defaults to 0.

  // Modifiers passed directly to the underlying Popper library.
  // See https://popper.js.org/popper-documentation.html#Popper.Defaults
  // Some useful ones include:
  //  .offset.offset: Offset of popup relative to trigger. Default 0 (but affected by arrow).
  modifiers?: Popper.Modifiers;
}

/**
 * IPopupControl allows the popup instances to open/close/update the popup as needed.
 */
export interface IPopupControl {
  open(delayMs?: number, reopen?: boolean): void;
  close(delayMs?: number): void;
  toggle(): void;
  isOpen(): boolean;
  update(): void;
}

/**
 * Type for the basic function which gets called to open a generic popup.
 */
export type IPopupFunc = (ctl: IPopupControl) => IPopupContent;

/**
 * Return value of IPopupFunc: a popup is a disposable object with the element to show in its
 * 'content' property. This object gets disposed when the popup is closed.
 *
 * The first element in content matching the '[x-arrow]' selector will be used as the arrow.
 */
export interface IPopupContent extends IDisposable {
  readonly content: Element;
}

/**
 * Type for a function to create a popup as a DOM element; usable with setPopupToCreateDom().
 */
export type IPopupDomCreator = (ctl: IPopupControl) => Element;

/**
 * The basic interface to attach a popup behavior to a trigger element. According to the requested
 * events on triggerElem, calls openFunc to open a popup, and disposes the returned value to close
 * it. The returned value is the same IPopupControl that gets passed to openFunc.
 *
 * Note that there is no default for options.trigger: if it's not specified, no events will
 * trigger this popup.
 */
export function setPopupToFunc(triggerElem: Element, openFunc: IPopupFunc,
                               options: IPopupOptions): IPopupControl {
  const handler = PopupController.create(null, triggerElem, openFunc, options);
  // Close popup on disposal of triggerElem.
  dom.autoDisposeElem(triggerElem, handler);
  return handler;
}

/**
 * Attaches the given element on open, detaches it on close. Useful e.g. for a static tooltip.
 */
export function setPopupToAttach(triggerElem: Element, content: Element,
                                 options: IPopupOptions): IPopupControl {
  const openResult: IPopupContent = {content, dispose: noop};
  return setPopupToFunc(triggerElem, () => openResult, options);
}

/**
 * Attaches the element returned by the given func on open, detaches and disposes it on close.
 */
export function setPopupToCreateDom(triggerElem: Element, domCreator: IPopupDomCreator,
                                    options: IPopupOptions): IPopupControl {
  function openFunc(ctl: IPopupControl) {
    const content = domCreator(ctl);
    function dispose() { domDispose(content); }
    return {content, dispose};
  }
  return setPopupToFunc(triggerElem, openFunc, options);
}

// Helper type for maintaining setTimeout() timers.
type TimerId = ReturnType<typeof setTimeout>;

/**
 * Implements the opening and closing of a popup. This object gets associated with a triggerElem
 * when a popup is configured, and subscribes to events as requested by the 'trigger' option.
 */
class PopupController extends Disposable implements IPopupControl {
  private _holder = Holder.create<OpenPopupHelper>(this);
  private _closeTimer?: TimerId;
  private _openTimer?: TimerId;
  private _open: () => void;
  private _close: () => void;
  private _showDelay: number;
  private _hideDelay: number;

  constructor(triggerElem: Element, openFunc: IPopupFunc, options: IPopupOptions) {
    super();
    this._showDelay = options.showDelay || 0;
    this._hideDelay = options.hideDelay || 0;
    this._open = () => {
      this._openTimer = undefined;
      OpenPopupHelper.create(this._holder, triggerElem, openFunc, options, this);
    };
    this._close = () => {
      this._closeTimer = undefined;
      this._holder.clear();
    };
    if (options.trigger) {
      for (const trigger of options.trigger) {
        switch (trigger) {
          case 'click':
            dom.onElem(triggerElem, 'click', () => this.toggle());
            break;
          case 'focus':
            dom.onElem(triggerElem, 'focus', () => this.open());
            dom.onElem(triggerElem, 'blur', () => this.close());
            break;
          case 'hover':
            dom.onElem(triggerElem, 'mouseenter', () => this.open());
            dom.onElem(triggerElem, 'mouseleave', () => this.close());
            break;
        }
      }
    }
  }

  /**
   * Open the popup. If reopen is true, it would replace a current open popup; otherwise if
   * this popup is already opened, the call is ignored.
   */
  public open(delay: number = this._showDelay, reopen: boolean = false) {
    // Ensure open() call cancels a delayed close() call.
    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = undefined;
    }
    if (reopen || (this._holder.isEmpty() && !this._openTimer)) {
      this._openTimer = setTimeout(this._open, delay);
    }
  }

  /**
   * Close the popup, if it is open.
   */
  public close(delay: number = this._hideDelay) {
    // Ensure closing cancels a delayed opening and vice versa.
    if (this._openTimer) {
      clearTimeout(this._openTimer);
      this._openTimer = undefined;
    }
    this._closeTimer = setTimeout(this._close, delay);
  }

  /**
   * Close the popup if it's open, open it otherwise.
   */
  public toggle() {
    this._holder.isEmpty() ? this.open(undefined, true) : this.close();
  }

  /**
   * Returns whether the popup is currently open.
   */
  public isOpen(): boolean {
    return !this._holder.isEmpty();
  }

  /**
   * Schedules a UI update for the popup's position.
   */
  public update() {
    const helper = this._holder.get();
    if (helper) { helper.update(); }
  }
}

/**
 * An internal class representing a single instance of the OPEN popup. This light-weight object is
 * created to open a popup and is disposed to close it.
 */
class OpenPopupHelper extends Disposable {
  private _popper: Popper;

  constructor(triggerElem: Element, openFunc: IPopupFunc, options: IPopupOptions, ctl: IPopupControl) {
    super();

    const popperOptions: Popper.PopperOptions = {
      placement: options.placement,
      modifiers: (options.boundaries ?
        defaultsDeep(options.modifiers, {
          flip: {boundariesElement: options.boundaries},
          preventOverflow: {boundariesElement: options.boundaries},
        }) :
        options.modifiers
      ),
    };

    // Once this object is disposed, unset all fields for easier detection of bugs.
    this.wipeOnDispose();

    // Call the opener function, and dispose the result when closed.
    const {content} = this.autoDispose(openFunc(ctl));

    // Find the requested attachment container.
    const containerElem = _getContainer(triggerElem, options.attach || null);
    if (containerElem) {
      containerElem.appendChild(content);
      this.onDispose(() => content.remove());
    }

    this._popper = new Popper(triggerElem, content, popperOptions);
    this.onDispose(() => this._popper.destroy());

    // On click anywhere on the page (outside triggerElem or popup content), close it.
    this.autoDispose(dom.onElem(document, 'click', (evt) => {
      const target: Node|null = evt.target as Node;
      if (target && !content.contains(target) && !triggerElem.contains(target)) {
        this.dispose();
      }
    }, {useCapture: true}));
  }

  public update() { this._popper.scheduleUpdate(); }
}

/**
 * Helper that finds the container according to IPopupOptions.container. Null means
 * elem.parentNode; string is a selector for the closest matching ancestor, e.g. 'body'.
 */
function _getContainer(elem: Element, attachElem: Element|string|null): Node|null {
  return (typeof attachElem === 'string') ? elem.closest(attachElem) :
    (attachElem || elem.parentNode);
}
