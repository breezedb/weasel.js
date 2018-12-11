/**
 * A menu is a collection of menu items. Besides holding the items, it also knows which item is
 * selected, and allows selection via the keyboard.
 *
 * The standard menu item offers enough flexibility to suffice for many needs, and may be replaced
 * entirely by a custom item. Most generally a menu item is a function that's given the observable
 * for whether the item is selected, and returns a DOM element.
 *
 * Clicks on items will normally propagate to the menu, where they get caught and close the menu.
 * If a click on an item should not close the menu, the item should stop the click's propagation.
 */
import {dom, domDispose, DomElementArg, DomElementMethod, styled} from 'grainjs';
import {computed, Disposable, Observable, observable, subscribe} from 'grainjs';
import defaultsDeep = require('lodash/defaultsDeep');
import {IPopupContent, IPopupOptions, PopupControl, setPopupToFunc} from './popup';

export type MenuCreateFunc = (ctl: PopupControl) => MenuItem[];

export type MenuItem = (isSelected: Observable<boolean>) => Element;

export interface IMenuOptions extends IPopupOptions {
  startIndex?: number;
  isSubMenu?: boolean;
}

/**
 * Attaches a menu to its trigger element, for example:
 *    dom('div', 'Open menu', menu((ctl) => [
 *      menuItem(...),
 *      menuItem(...),
 *    ]))
 */
export function menu(createFunc: MenuCreateFunc, options?: IMenuOptions): DomElementMethod {
  return (elem) => menuElem(elem, createFunc, options);
}
export function menuElem(triggerElem: Element, createFunc: MenuCreateFunc, options: IMenuOptions = {}) {
  options = defaultsDeep({}, options, defaultMenuOptions);
  setPopupToFunc(triggerElem,
    (ctl, opts) => Menu.create(null, ctl, createFunc(ctl), defaultsDeep(opts, options)),
    options);
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
  return (isSelected: Observable<boolean>) => cssMenuItem(
    ...args,
    cssMenuItem.cls('-sel', isSelected),
    dom.on('click', action),
    onKeyDown({Enter$: action}),
  );
}

const defaultMenuOptions: IMenuOptions = {
  attach: 'body',
  boundaries: 'viewport',
  placement: 'bottom-start',
  showDelay: 0,
  trigger: ['click'],
};

/**
 * Implementation of the Menu. See menu() documentation for usage.
 */
export class Menu extends Disposable implements IPopupContent {
  public readonly content: Element;

  private _items: Element[];
  private _selIndex: Observable<number>;

  constructor(ctl: PopupControl, items: MenuItem[], options: IMenuOptions = {}) {
    super();
    this._selIndex = observable<number>(options.startIndex === undefined ? -1 : options.startIndex);

    // The call to autoDispose in a loop is intenional here: we create a computed for each item,
    // and need to dispose them all.
    this._items = items.map((item, i) =>
      item(this.autoDispose(computed<boolean>((use) => use(this._selIndex) === i))));

    // When selIndex changes, focus the newly-selected element. We use focus for keyboard events.
    this.autoDispose(subscribe(this._selIndex, (use, selIndex) => {
      const elem = this._items[selIndex] as HTMLElement;
      if (elem) { elem.focus(); }
    }));

    this.content = cssMenu(this._items,
      dom.on('mouseover', (ev) => this._onMouseOver(ev as MouseEvent)),
      dom.on('click', (ev) => ctl.close(0)),
      onKeyDown({
        ArrowDown: () => this._nextIndex(),
        ArrowUp: () => this._prevIndex(),
        ... options.isSubMenu ? {
          ArrowLeft: () => ctl.close(0),
        } : {
          Escape: () => ctl.close(0),
          Enter: () => ctl.close(0),    // gets bubbled key after action is taken.
        }
      }),
    );
    this.onDispose(() => domDispose(this.content));

    FocusLayer.create(this, this.content);
  }

  private _nextIndex(): void {
    this._selIndex.set((this._selIndex.get() + 1) % this._items.length);
  }
  private _prevIndex(): void {
    const N = this._items.length;
    this._selIndex.set((Math.max(this._selIndex.get(), 0) + N - 1) % N);
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
 * Implements a menu item which opens a submenu.
 */
export function menuItemSubmenu(submenu: MenuCreateFunc, ...args: DomElementArg[]): MenuItem {
  const ctl: PopupControl<IMenuOptions> = PopupControl.create(null);

  const popupOptions: IMenuOptions = {
    placement: 'right-start',
    trigger: ['click'],
    attach: null,
    modifiers: {preventOverflow: {padding: 10}},
    boundaries: 'viewport',
    controller: ctl,
    isSubMenu: true,
  };

  return (isSelected: Observable<boolean>) =>
    cssMenuItem(...args, cssMenuItem.cls('-sel', isSelected),
      dom('div', '\u25B6'),     // A right-pointing triangle

      dom.autoDispose(ctl),
      menu(submenu, popupOptions),

      // On mouseover, open the submenu. Add a delay to avoid it on transient mouseovers.
      dom.on('mouseover', () => ctl.open({showDelay: 250})),

      // On right-arrow, open the submenu immediately, and select the first item automatically.
      onKeyDown({
        ArrowRight: () => ctl.open({startIndex: 0}),
        Enter: () => ctl.open({startIndex: 0}),
      }),

      // When selection changes, close the popup; remember to dispose this subscription.
      dom.autoDispose(subscribe((use) => use(isSelected) || ctl.close())),

      // Clicks that open a submenu should not cause parent menu to close.
      dom.on('click', (ev) => { ev.stopPropagation(); }),
    );
}

export const cssMenu = styled('ul', `
  position: absolute;
  background: white;
  color: #1D1729;
  min-width: 160px;
  outline: none;
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
  outline: none;

  &-sel {
    background-color: #5AC09C;
    color: white;
  }
`);

// ----------------------------------------------------------------------
// TODO: move this to grainjs
// Document: e.g. "Enter" handles the key and stops propagation, "Enter$" handles Enter and lets
// it bubble.
function onKeyDownElem(elem: Element, keyHandlers: {[key: string]: (ev: Event) => void}): void {
  if (!((elem as HTMLElement).tabIndex >= 0)) {   // Check if tabIndex is undefined or -1.
    elem.setAttribute('tabindex', '-1');          // Make the element focusable.
  }
  dom.onElem(elem, 'keydown', (ev: Event) => {
    const handler = keyHandlers[(ev as KeyboardEvent).key];
    if (handler) {
      ev.stopPropagation();
      handler(ev);
    } else {
      const bubbleHandler = keyHandlers[(ev as KeyboardEvent).key + '$'];
      if (bubbleHandler) {
        bubbleHandler(ev);
      }
    }
  });
}

function onKeyDown(keyHandlers: {[key: string]: (ev: Event) => void}): DomElementMethod {
  return (elem) => onKeyDownElem(elem, keyHandlers);
}

class FocusLayer extends Disposable {
  constructor(content: Element) {
    super();
    const previous: Element|null = document.activeElement;
    if (previous) {
      this.onDispose(() => (previous as HTMLElement).focus());
    }
    setTimeout(() => (content as HTMLElement).focus(), 0);
  }
}
