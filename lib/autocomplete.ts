import {dom, DomElementArg, onElem, onKeyElem} from 'grainjs';
import {MaybeObsArray} from 'grainjs';
import {BaseMenu, defaultMenuOptions, IMenuOptions, menuItem} from './menu';
import {IOpenController, IPopupContent, PopupControl, setPopupToFunc} from './popup';

/**
 * User interface for creating a weasel autocomplete element in DOM.
 *
 * Usage:
 *      const employees = ['Thomas', 'June', 'Bethany', 'Mark', 'Marjorey', 'Zachary'];
 *      const inputElem = input(...);
 *      autocomplete(inputElem, employees);
 */
export function autocomplete<T>(
  inputElem: HTMLInputElement,
  optionArray: MaybeObsArray<string>,
  options: IMenuOptions = {}
): HTMLInputElement {

  // Options to pass into the Autocomplete class.
  const menuOptions: IMenuOptions = {
    ...defaultMenuOptions,
    menuCssClass: options.menuCssClass,
    trigger: [(triggerElem: Element, ctl: PopupControl) => {
      dom.onElem(triggerElem, 'click', () => ctl.open())
    }],
    stretchToSelector: 'input'
  };

  // DOM content of the open autocomplete menu.
  const menuContent = () => [
    dom.forEach(optionArray, (option) =>
      menuItem(() => { inputElem.value = option; },
        option
      )
    )
  ];

  setPopupToFunc(inputElem,
    (ctl) => Autocomplete.create(null, ctl, menuContent(), menuOptions),
    menuOptions);

  return inputElem;
}

/**
 * Creates an instance of Menu meant to be attached to an input and used as an autocomplete.
 *
 * Should always be created using autocomplete(), which accepts as an argument the input element.
 */
export class Autocomplete extends BaseMenu implements IPopupContent {
  private readonly _rows: HTMLElement[] = Array.from(this._menuContent.children) as HTMLElement[];

  constructor(ctl: IOpenController, items: DomElementArg[], options: IMenuOptions = {}) {
    super(ctl, items, options);
    this.focusOnSelected = false;

    const trigger = ctl.getTriggerElem() as HTMLInputElement;

    // Add key handlers to the trigger element as well as the menu if it is an input.
    this.autoDispose(onKeyElem(trigger, 'keydown', {
      ArrowDown: () => this.nextIndex(),
      ArrowUp: () => this.prevIndex(),
      Enter$: () => this._setInputValue(ctl),
      Escape$: () => ctl.close(0)
    }));

    this.autoDispose(onElem(trigger, 'input', () => {
      this._selectRow(trigger.value);
    }));

    if (trigger.value) {
      this._selectRow(trigger.value);
    }
  }

  private _selectRow(inputVal: string): void {
    const lowercaseVal = inputVal.toLowerCase();
    if (lowercaseVal) {
      const elem = this._rows.find(_elem =>
        Boolean(_elem.textContent && _elem.textContent.toLowerCase().startsWith(lowercaseVal)));
      this.setSelected(elem || null);
    }
  }

  private _setInputValue(ctl: IOpenController): void {
    const inputElem = ctl.getTriggerElem() as HTMLInputElement;
    if (this._selected) {
      inputElem.value = this._selected.textContent || '';
      ctl.close(0);
    }
  }
}
