/**
 *
 * A menu is a collection of menu items. Besides holding the items, it also knows which item is
 * selected, and allows selection via the keyboard.
 * TODO: implement selection via keyboard
 *    Up/Down
 *    Right to open submenu, left to close submenu
 *    Esc to close top menu
 *    Enter to trigger current item.
 *
 * The standard menu item offers enough flexibility to suffice for many needs, and may be replaced
 * entirely by a custom item. Most generally a menu item is a function that's given the observable
 * for whether the item is selected, and returns a DOM element.
 *
 * Clicks on items will normally propagate to the menu, where they get caught and close the menu.
 * If a click on an item should not close the menu, the item should stop the click's propagation.
 */
import {dom, domDispose, DomElementArg, DomElementMethod, styled} from 'grainjs';
import {computed, Disposable, IDisposable, Observable, observable, subscribe} from 'grainjs';
import defaults = require('lodash/defaults');
import pull = require('lodash/pull');
import {IPopupContent, IPopupControl, IPopupOptions, setPopupToFunc} from './popup';

export type MenuCreateFunc = (ctl: IPopupControl) => Menu;

/**
 * Attaches a menu to its trigger element, for example:
 *    dom('div', 'Open menu', menu((ctl) => Menu.create(null, ctl, [
 *      menuItem(...),
 *      menuItem(...),
 *    ])))
 */
export function menu(createFunc: MenuCreateFunc, options?: IPopupOptions): DomElementMethod {
  return (elem) => menuElem(elem, createFunc, options);
}
export function menuElem(triggerElem: Element, createFunc: MenuCreateFunc, options: IPopupOptions = {}) {
  options = defaults({}, options, defaultMenuOptions);
  setPopupToFunc(triggerElem, createFunc, options);
}

const defaultMenuOptions: IPopupOptions = {
  attach: 'body',
  boundaries: 'viewport',
  placement: 'bottom-start',
  showDelay: 0,
  trigger: ['click'],
};

export type MenuItem = (isSelected: Observable<boolean>) => Element;

// TODO All of this having to do with Keyboard handling feels ugly.
type KeyHandler = (ev: KeyboardEvent) => void;
const handlers: KeyHandler[] = [];
let listener: IDisposable|null = null;
function onKeydownEvent(handler: KeyHandler) {
  if (!listener) {
    listener = dom.onElem(document.body, 'keydown', (ev) => handleKey(ev as KeyboardEvent));
  }
  handlers.unshift(handler);
  return {dispose: () => removeHandler(handler)};
}
function removeHandler(handler: KeyHandler) {
  pull(handlers, handler);
  if (handlers.length === 0 && listener) {
    listener.dispose();
    listener = null;
  }
}
function handleKey(ev: KeyboardEvent) {
  let stop = false;
  ev.stopPropagation = () => { stop = true; };
  for (const h of handlers) {
    h(ev);
    if (stop) { break; }
  }
}

/**
 * Implementation of the Menu. See menu() documentation for usage.
 */
export class Menu extends Disposable implements IPopupContent {
  public readonly content: Element;

  private _items: Element[];
  private _selIndex = observable<number>(-1);

  constructor(ctl: IPopupControl, items: MenuItem[]) {
    super();

    // The call to autoDispose in a loop is intenional here: we create a computed for each item,
    // and need to dispose them all.
    this._items = items.map((item, i) =>
      item(this.autoDispose(computed<boolean>((use) => use(this._selIndex) === i))));

    this.content = cssMenu(this._items,
      dom.on('mouseover', (ev) => this._onMouseOver(ev as MouseEvent)),
      dom.on('click', (ev) => ctl.close(0)),
    );
    this.onDispose(() => domDispose(this.content));
    this.autoDispose(onKeydownEvent((ev) => {
      const pos = this._selIndex.get();
      const N = this._items.length;
      switch ((ev as KeyboardEvent).key) {
        case 'ArrowDown': this._selIndex.set((pos + 1) % N); ev.stopPropagation(); break;
        case 'ArrowUp': this._selIndex.set((Math.max(pos, 0) + N - 1) % N); ev.stopPropagation(); break;
        case 'Escape': ctl.close(0); break;
      }
    }));
  }

  private _onMouseOver(ev: MouseEvent) {
    // Find immediate child of this.content which is an ancestor of ev.target.
    const child = findAncestorChild(this.content, ev.target as Element);
    const index = child ? this._items.indexOf(child) : -1;
    if (index >= 0) {
      this._selIndex.set(index);
    }
  }
}

/**
 * Helper function which returns the direct child of ancestor which is an ancestor of elem, or
 * null if elem is not a descendant of ancestor.
 */
function findAncestorChild(ancestor: Element, elem: Element|null): Element|null {
  while (elem && elem.parentNode !== ancestor) {
    elem = elem.parentElement;
  }
  return elem;
}

/**
 * Implements a single menu item.
 * TODO: support various useful options. For example, Grist's SelectMenu provides the following,
 * and also a SelectMenu.SEPARATOR element.
 *    interface SelectMenuItem {
 *       name: string;             // The name to show
 *       action?: () => void;      // If present, call this when the (non-disabled) item is clicked
 *       disabled?: boolean | () => boolean;   // When this item should be disabled
 *       show?: observable<boolean> | () => boolean;   // When to show this item
 *       hide?: observable<boolean> | () => boolean;   // When to hide this item
 *       icon?: Element;           // Icon to display to the left of the name
 *       shortcut?: Element;       // Representation of the shortcut key, right-aligned
 *       href?: string;            // If present, item will be a link with this "href" attr
 *       download?: string;        // with href set, "download" attr (file name) for the link
 *    }
 */
export function menuItem(action: () => void, ...args: DomElementArg[]): MenuItem {
  return (isSelected: Observable<boolean>) =>
    cssMenuItem(...args, cssMenuItem.cls('-sel', isSelected),
      dom.on('click', action)
    );
}

/**
 * Implements a menu item which opens a submenu.
 */
export function menuItemSubmenu(submenu: MenuCreateFunc, ...args: DomElementArg[]): MenuItem {
  let startIndex = -1;
  return (isSelected: Observable<boolean>) =>
    cssMenuItem(...args, cssMenuItem.cls('-sel', isSelected),
      dom('div', '\u25B6'),     // A right-pointing triangle

      // Attach the submenu to this item, to open on click and mouseover.
      (elem: Element) => {
        const popup = setPopupToFunc(elem, (ctl) => {
          const m = submenu(ctl);
          (m as any)._selIndex.set(startIndex);
          startIndex = -1;
          return m;
        }, {
          placement: 'right-start',
          trigger: ['click'],
          attach: null,
          modifiers: {preventOverflow: {padding: 10}},
          boundaries: 'viewport',
        });
        // On mouseover, open the submenu. Add a delay to avoid it on transient mouseovers.
        dom.onElem(elem, 'mouseover', () => popup.open(250));
        // On selecting another item close the submenu.
        dom.autoDisposeElem(elem, subscribe((use) => use(isSelected) || popup.close()));

        // TODO: Want to select first element of submenu when it's opened via keyboard.
        // TODO: stuff with isSelected.get and stopPropagation feels very ugly.
        dom.autoDisposeElem(elem, onKeydownEvent((ev) => {
          switch ((ev as KeyboardEvent).key) {
            case 'ArrowRight': if (isSelected.get()) { startIndex = 0; popup.open(); ev.stopPropagation(); } break;
            case 'ArrowLeft': if (isSelected.get() && popup.isOpen()) { popup.close(); ev.stopPropagation(); } break;
          }
        }));
      },

      // Clicks that open a submenu should not cause parent menu to close.
      dom.on('click', (ev) => { ev.stopPropagation(); }),
    );
}

export const cssMenu = styled('ul', `
  position: absolute;
  background: white;
  color: #1D1729;
  min-width: 160px;
  border-radius: 3px;
  box-shadow: 0 0 2px rgba(0,0,0,0.5);
  list-style: none;
  padding: 16px 0px;
  margin: 2px;
  text-align: left;
`);

export const cssMenuItem = styled('li', `
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;

  &-sel {
    background-color: #5AC09C;
    color: white;
  }
`);
