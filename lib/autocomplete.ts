import {dom, DomElementArg, MaybeObsArray, onElem, onKeyElem} from 'grainjs';
import {BaseMenu, defaultMenuOptions, IMenuOptions, menuItem} from './menu';
import {IOpenController, IPopupContent, PopupControl, setPopupToFunc} from './popup';

/**
 * IAutocomplete options adds two properties IMenuOptions to customize autocomplete behavior:
 *
 * contentFunc: Overrides the passed-in optionArray to allow creating menu rows
 *   with special behavior when selected.
 *
 * findMatch: Overrides default case-insensitive row select behavior.
 */
export interface IAutocompleteOptions extends IMenuOptions {
  contentFunc?: (ctl: IOpenController) => DomElementArg[];
  findMatch?: (content: HTMLElement[], value: string) => HTMLElement|null;
}

const defaultFindMatch = (content: HTMLElement[], val: string) => {
  val = val.toLowerCase();
  return content.find((el: any) => el.textContent.toLowerCase().startsWith(val)) || null;
};

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
  options: IAutocompleteOptions = {}
): HTMLInputElement {
  // Add default values for contentFunc and findMatch.
  options = {
    // Default contentFunc uses the optionArray and sets the input to the text option on select.
    contentFunc: (ctl: IOpenController) => [
      dom.forEach(optionArray, (opt) =>
        menuItem(() => { inputElem.value = opt; }, opt,
          // Prevent input from being blurred on menuItem click.
          dom.on('mousedown', (ev) => { ev.preventDefault(); })
        )
      )
    ],
    ...options
  };

  // Options to pass into the Autocomplete class.
  const menuOptions: IAutocompleteOptions = {
    ...defaultMenuOptions,
    trigger: [(triggerElem: Element, ctl: PopupControl) => {
      dom.onElem(triggerElem, 'focus', () => ctl.open());
      dom.onKeyElem(triggerElem as HTMLElement, 'keydown', {
        ArrowDown: () => ctl.open(),
        ArrowUp: () => ctl.open()
      });
    }],
    stretchToSelector: 'input, textarea',
    ...options
  };

  const contentFunc = options.contentFunc!;
  setPopupToFunc(inputElem,
    (ctl) => Autocomplete.create(null, ctl, contentFunc(ctl), menuOptions),
    menuOptions);

  return inputElem;
}

/**
 * Creates an instance of Menu meant to be attached to an input and used as an autocomplete.
 *
 * Should always be created using autocomplete(), which accepts as an argument the input element.
 */
class Autocomplete extends BaseMenu implements IPopupContent {
  private readonly _rows: HTMLElement[] = Array.from(this._menuContent.children) as HTMLElement[];
  private readonly _findMatch: (content: HTMLElement[], value: string) => HTMLElement|null;

  constructor(ctl: IOpenController, items: DomElementArg[], options: IAutocompleteOptions) {
    super(ctl, items, options);
    this.focusOnSelected = false;

    this._findMatch = options.findMatch || defaultFindMatch;

    const trigger = ctl.getTriggerElem() as HTMLInputElement;

    // Add key handlers to the trigger element as well as the menu if it is an input.
    this.autoDispose(onKeyElem(trigger, 'keydown', {
      ArrowDown: () => this.nextIndex(),
      ArrowUp: () => this.prevIndex(),
      Enter$: () => this._selected && this._selected.click(),
      Escape: () => ctl.close(0)
    }));

    this.autoDispose(onElem(trigger, 'input', () => {
      this._selectRow(trigger.value);
    }));

    if (trigger.value) {
      this._selectRow(trigger.value);
    }
  }

  private _selectRow(inputVal: string): void {
    const match: HTMLElement|null = this._findMatch(this._rows, inputVal);
    this.setSelected(match);
  }
}
