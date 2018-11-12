import {dom, DomElementMethod, styled} from 'grainjs';
import {IPopupOptions, setPopupToCreateDom} from './popup';

/**
 * Tooltip accepts all the options of other popup methods, plus a couple more.
 */
export interface ITooltipOptions extends IPopupOptions {
  content?: DomElementMethod;   // If omitted, will use the "title" attribute of triggerElem.
  title?: string;               // Default title when content is omitted, and triggerElem has no title.
}

const defaultTooltipOptions: ITooltipOptions = {
  placement: 'top',
  showDelay: 0,
  trigger: ['hover', 'focus'],
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
export function tooltipElem(triggerElem: Element, options: ITooltipOptions = {}): void {
  const opts: ITooltipOptions = {...defaultTooltipOptions, ...options};

  // The simple solution is this:
  return setPopupToCreateDom(triggerElem, () => _createDom(triggerElem, opts), opts);

  // More involved, and less pleasant, perhaps unnecessarily, is this, which turns off the title,
  // so that the native tooltip isn't shown while the custom one shows. Popper's tooltip.js
  // library does NOT do such turning off, but examples don't use title attribute.
  /*
  function openFunc(ctl: IPopupControl) {
    const title = triggerElem.getAttribute('title') || options.title || "";
    triggerElem.removeAttribute('title');
    const content = _createDom(triggerElem, opts, title);
    function dispose() {
      content.remove();
      // Only restore the attribute if it's still absent.
      if (!triggerElem.hasAttribute('title')) {
        triggerElem.setAttribute('title', title);
      }
      domDispose(content);
    }
    return {content, dispose};
  }
  setPopupToFunc(triggerElem, openFunc, opts);
  */
}

// TODO: this attempt exposes quite a bunch of problems with current design:
// (1) openPopup() method needs triggerElem
// (2) closePopup() vs dispose() distinction does not make sense.
//     Should be enough to construct+dispose.
// (3) responsibility for attaching/detaching isn't symmetrical: popup.js attaches but caller is
//     supposed to detach.
// (4) It's way more verbose than the functional way (ctor/dtor simplifications might improve)
/*
class Tooltip implements IPopupContent, IDisposable {
  private _content?: Element;
  private _title?: string;
  private _triggerElem?: Element;

  constructor(private _options: ITooltipOptions) {}
  // Called when the popup needs to open. Should the popup element to render. If an arrow is
  // desired, it should be an element matching `[x-arrow]` selector within Element.
  public openPopup(triggerElem: Element, ctl: IPopupControl): Element {
    this._title = triggerElem.getAttribute('title') || this._options.title || "";
    this._triggerElem = triggerElem;
    this._triggerElem.removeAttribute('title');
    const opts: ITooltipOptions = {...defaultTooltipOptions, ...this._options};
    this._content = _createDom(triggerElem, opts, this._title);
    return this._content;
  }
  public closePopup(): void {
    this._content!.remove();
    if (!this._triggerElem!.hasAttribute('title')) {
      this._triggerElem!.setAttribute('title', this._title!);
    }
    domDispose(this._content!);
  }
  public dispose() {
    // noop
  }
}
*/

/**
 * Helper that creates an actual tooltip, with some styles and a little arrow.
 */
function _createDom(triggerElem: Element, options: ITooltipOptions, title?: string) {
  if (!title) { title = triggerElem.getAttribute('title') || options.title || ""; }
  return cssTooltip({role: 'tooltip'},
    cssTooltipArrow({'x-arrow': true}),
    dom('div', options.content || dom.text(title)),
  );
}

const cssTooltip = styled('div', `
  position: absolute;
  background: #FFC107;
  color: black;
  width: 150px;
  border-radius: 3px;
  box-shadow: 0 0 2px rgba(0,0,0,0.5);
  padding: 10px;
  text-align: center;

  &[x-placement^="bottom"] { margin-top: 5px; }
  &[x-placement^="top"] { margin-bottom: 5px; }
  &[x-placement^="left"] { margin-right: 5px; }
  &[x-placement^="right"] { margin-left: 5px; }
`);

const cssTooltipArrow = styled('div', `
  width: 0;
  height: 0;
  border-style: solid;
  border-color: #FFC107;
  position: absolute;
  margin: 5px;

  .${cssTooltip.className}[x-placement^="bottom"] & {
    border-width: 0 5px 5px 5px;
    border-left-color: transparent;
    border-right-color: transparent;
    border-top-color: transparent;
    top: -5px;
    left: calc(50% - 5px);
    margin-top: 0;
    margin-bottom: 0;
  }
  .${cssTooltip.className}[x-placement^="top"] & {
    border-width: 5px 5px 0 5px;
    border-left-color: transparent;
    border-right-color: transparent;
    border-bottom-color: transparent;
    bottom: -5px;
    left: calc(50% - 5px);
    margin-top: 0;
    margin-bottom: 0;
  }
  .${cssTooltip.className}[x-placement^="left"] & {
    border-width: 5px 0 5px 5px;
    border-top-color: transparent;
    border-right-color: transparent;
    border-bottom-color: transparent;
    right: -5px;
    top: calc(50% - 5px);
    margin-left: 0;
    margin-right: 0;
  }
  .${cssTooltip.className}[x-placement^="right"] & {
    border-width: 5px 5px 5px 0;
    border-left-color: transparent;
    border-top-color: transparent;
    border-bottom-color: transparent;
    left: -5px;
    top: calc(50% - 5px);
    margin-left: 0;
    margin-right: 0;
  }
`);
