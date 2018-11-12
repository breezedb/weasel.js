import {Disposable, dom, domDispose, Holder, IDisposable} from 'grainjs';
import debounce = require('lodash/debounce');
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
  container?: Element|string|null;

  // On what events, the popup is triggered.
  trigger?: Trigger[];

  showDelay?: number;       // Delay to show the popup. Defaults to 0.
  hideDelay?: number;       // Delay to hide the popup. Defaults to 0.

  // Modifiers passed directly to the underlying Popper library.
  // See https://popper.js.org/popper-documentation.html#Popper.Defaults
  // Some useful ones include:
  //  .offset.offset: Offset of popup relative to trigger. Default 0.
  //  .flip.boundariesElement: Boundary to flip the popup. Default: 'viewport'.
  //  .preventOverflow.boundariesElement: Boundary to keep popup in view. Default 'scrollParent'.
  modifiers?: Popper.Modifiers;
}

/**
 * For the low-level interface, IPopupControl allows the popup-implementing function to close or
 * reposition the popup while it is open.
 */
export interface IPopupControl {
  close(): void;
  update(): void;
}

/**
 * The recommended interface for popups to implement. It may be used with setPopupToOpen() or
 * setPopupToCreate() functions. For the latter one, the IPopupContent also needs to be disposable.
 */
export interface IPopupContent {
  // Called when the popup needs to open. Should the popup element to render. If an arrow is
  // desired, it should be an element matching `[x-arrow]` selector within Element.
  openPopup(ctl: IPopupControl): Element;

  // Called when the popup is closed.
  closePopup(): void;
}

/**
 * Creator func used for the setPopupToCreate() method.
 */
export type IPopupCreatorFunc = () => IPopupContent & IDisposable;

/**
 * The return value for the openFunc used for the low-level setPopupToFunc() interface. To open a
 * popup, the function needs to return an object with the content element to show and a dispose()
 * method. The returned object gets disposed when the popup is closed.
 *
 * The first element in content matching the '[x-arrow]' selector will be used as the arrow.
 */
export interface IPopupOpenResult extends IDisposable {
  readonly content: Element;
}

/**
 * The type of the low-level function to open a generic popup.
 */
export type IPopupOpenFunc = (ctl: IPopupControl) => IPopupOpenResult;

/**
 * Low-level interface to attach a popup behavior to a trigger element. According to requested
 * events on triggerElem, calls openFunc to open a popup, and disposes the returned value to close
 * it. Note that there is no default for options.trigger: if it's not specified, no events will
 * trigger this popup.
 */
export function setPopupToFunc(triggerElem: Element, openFunc: IPopupOpenFunc, options: IPopupOptions): void {
  const holder = new Holder<OpenPopupHelper>();

  // Close popup on disposal of triggerElem.
  dom.autoDisposeElem(triggerElem, holder);

  function _open() { OpenPopupHelper.create(holder, triggerElem, openFunc, options); }
  function _close() { holder.clear(); }

  // If asked to delay, use debounced versions to open and close.
  type CB = (() => void) & {cancel?: () => void};
  const doOpen: CB = options.showDelay ? debounce(_open, options.showDelay, {leading: true}) : _open;
  const doClose: CB = options.hideDelay ? debounce(_close, options.hideDelay, {leading: true}) : _close;

  // Ensure closing cancels a delayed opening and vice versa.
  function open() { if (doClose.cancel) { doClose.cancel(); } doOpen(); }
  function close() { if (doOpen.cancel) { doOpen.cancel(); } doClose(); }
  function toggle() { holder.isEmpty() ? open() : close(); }

  if (options.trigger) {
    for (const trigger of options.trigger) {
      switch (trigger) {
        case 'click':
          dom.onElem(triggerElem, 'click', toggle);
          break;
        case 'focus':
          dom.onElem(triggerElem, 'focus', open);
          dom.onElem(triggerElem, 'blur', close);
          break;
        case 'hover':
          dom.onElem(triggerElem, 'mouseenter', open);
          // TODO not quite right: don't want to close if moved mouse over the popup contents.
          dom.onElem(triggerElem, 'mouseleave', close);
          break;
      }
    }
  }
}

/**
 * An internal class implementing setPopupToFunc(). It represents a single instance of the OPEN
 * popup. This light-weight object is created to open a popup and disposed to close it.
 */
class OpenPopupHelper extends Disposable implements IPopupControl {
  private _popper: Popper;

  constructor(triggerElem: Element, openFunc: IPopupOpenFunc, options: IPopupOptions) {
    super();

    const popperOptions: Popper.PopperOptions = {
      placement: options.placement,
      modifiers: options.modifiers,
    };

    // Once this object is disposed, unset all fields for easier detection of bugs.
    this.wipeOnDispose();

    // Call the opener function, and dispose the result when closed.
    const {content} = this.autoDispose(openFunc(this));

    // Find the requested container.
    const containerElem = _getContainer(triggerElem, options.container || null);
    if (containerElem) {
      containerElem.appendChild(content);
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

  public close() { this.dispose(); }
  public update() { this._popper.scheduleUpdate(); }
}

/**
 * Helper that finds the container according to IPopupOptions.container. Null means
 * elem.parentNode; string is a selector for the closest matching ancestor, e.g. 'body'.
 */
function _getContainer(elem: Element, container: Element|string|null): Node|null {
  return (typeof container === 'string') ? elem.closest(container) :
    (container || elem.parentNode);
}

/**
 * Calls popup.openPopup() on open, popup.closePopup() on close. Useful when there is persistent
 * component containing the popup content, such as a static (unchanging) menu.
 */
export function setPopupToOpen(triggerElem: Element, popup: IPopupContent, options: IPopupOptions): void {
  const openFunc = (ctl: IPopupControl) => ({
    content: popup.openPopup(ctl),
    dispose: () => popup.closePopup(),
  });
  setPopupToFunc(triggerElem, openFunc, options);
}

/**
 * Attaches the given element on open, detaches it on close. Could be used e.g. for a static tooltip.
 */
export function setPopupToAttach(triggerElem: Element, myDom: Element, options: IPopupOptions): void {
  const openFunc = (ctl: IPopupControl) => ({
    content: myDom,
    dispose: () => myDom.remove(),
  });
  setPopupToFunc(triggerElem, openFunc, options);
}

/**
 * Attaches the element returned by the given func on open, detaches and disposes itt on close.
 */
export function setPopupToCreateDom(triggerElem: Element, domCreator: () => Element, options: IPopupOptions): void {
  function openFunc(ctl: IPopupControl) {
    const content = domCreator();
    function dispose() { content.remove(); domDispose(content); }
    return {content, dispose};
  }
  setPopupToFunc(triggerElem, openFunc, options);
}

/**
 * On opening the popup, calls the creator function, and .openPopup(ctl) on the created object. On
 * closing the popup, calls .closePopup() and then .dispose() on the created object.
 */
export function setPopupToCreate(triggerElem: Element, creatorFunc: IPopupCreatorFunc, options: IPopupOptions): void {
  function openFunc(ctl: IPopupControl): IPopupOpenResult {
    const popup = creatorFunc();
    return {
      content: popup.openPopup(ctl),
      dispose: () => { popup.closePopup(); popup.dispose(); },
    };
  }
  setPopupToFunc(triggerElem, openFunc, options);
}
