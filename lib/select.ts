import {Computed, dom, DomArg, DomElementArg, onElem, Observable, styled} from 'grainjs';
import {BaseMenu, baseElem, IMenuOptions, menuItem} from './menu';
import {IOpenController, PopupControl} from './popup';

export interface IOptionFull<T> {
  value: T;
  label: string;
  disabled?: boolean;
  [addl: string]: any;
};

// For string options, we can use a string for label and value without wrapping into an object.
export type IOption<T> = (T & string) | IOptionFull<T>;

export interface ISelectUserOptions {
  defaultLabel?: string,   // Button label displayed when no value is selected.
  buttonArrow?: DomArg,    // DOM for what is typically the chevron on the select button.
  menuCssClass?: string,
  buttonCssClass?: string
}

export interface ISelectOptions extends IMenuOptions {
  selectLabelOnOpen?: () => string;  // Selects the items with the given label on open.
};

/**
 * User interface for creating a weasel select element in DOM.
 *
 * Usage:
 *    const fruit = observable("apple");
 *    select(fruit, () => ["apple", "banana", "mango"]);
 *
 *    const employee = observable(17);
 *    const employeesCB = () => [
 *      {value: 12, label: "Bob", disabled: true},
 *      {value: 17, label: "Alice"},
 *      {value: 21, label: "Eve"},
 *    ];
 *    select(employee, employeesCB, {defaultLabel: "Select employee:"});
 */
export function select<T>(
  obs: Observable<T>,
  callback: () => Array<IOption<T>>,
  options: ISelectUserOptions = {},
  renderOption: (option: IOptionFull<T|null>) => DomArg = (option) => option.label
): Element {
  // Create SelectKeyState to manage user value search inputs.
  const keyState = new SelectKeyState<T>(callback);

  // Computed contains the IOptionFull of the obs value.
  const selected = Computed.create(null, obs, (use, val) => {
    const option = callback().find(_op => val === getOptionFull(_op).value);
    return option ? getOptionFull(option) : ({value: null, label: ''} as IOptionFull<null>);
  });

  const container: Element = cssSelectBtn({tabIndex: '0', class: options.buttonCssClass || ''},
    dom.autoDispose(selected),
    dom.domComputed(selected, sel =>
      renderOption(sel.label ? sel : {value: null, label: options.defaultLabel || ""})),
    options.buttonArrow,
    dom.on('keydown', (ev) => {
      const sel = keyState.add(ev.key);
      if (sel) { obs.set(sel.value); }
    }),
    (elem) => baseElem((...args) => Select.create(...args), elem, () => [
      (elem) => stretchMenuToContainer(elem, container),
      dom.forEach(callback(), (option) => {
        const obj: IOptionFull<T> = getOptionFull(option);
        // Note we only set 'selected' when an <option> is created; we are not subscribing to obs.
        // This is to reduce the amount of subscriptions, esp. when number of options is large.
        return menuItem(() => { obs.set(obj.value); },
          Object.assign({ disabled: obj.disabled, selected: obj.value === obs.get() },
            obj.disabled ? { class: 'disabled'} : {}),
          renderOption(obj)
        );
      }),
    ], {
      menuCssClass: options.menuCssClass,
      trigger: [(triggerElem: Element, ctl: PopupControl) => {
        dom.onElem(triggerElem, 'click', () => ctl.toggle()),
        dom.onKeyElem(triggerElem as HTMLElement, 'keydown', {
          ArrowDown: () => ctl.open(),
          ArrowUp: () => ctl.open()
        })
      }],
      selectLabelOnOpen: () => selected.get().label
    })
  );
  return container;
}

/**
 * Creates an instance of Menu intended to mimic the behavior of the select HTML element.
 *
 * Should always be created using select(), which adds the select button and associated logic.
 */
class Select<T> extends BaseMenu {
  private _selectRows: HTMLElement[] = Array.from(this.content.children) as HTMLElement[];
  private _keyState: SelectKeyState<string> = new SelectKeyState(() =>
    this._selectRows.map(_elem => ({
      label: _elem.textContent || "",
      value: _elem.textContent || "",
      disabled: _elem.classList.contains('disabled')
    }))
  );

  constructor(ctl: IOpenController, items: DomElementArg[], options: ISelectOptions = {}) {
    super(ctl, items, options);

    // On keydown, search for the first element with a matching label.
    onElem(this.content, 'keydown', (ev) => {
      const sel = this._keyState.add(ev.key);
      if (sel) { this._selectRow(sel.label); }
    });

    // If an initial value is given, use it, otherwise select the first element.
    const init = options.selectLabelOnOpen ? options.selectLabelOnOpen() : null;
    setTimeout(() => (init ? this._selectRow(init) : this.nextIndex()), 0);
  }

  private _selectRow(label: string): void {
    const elem = this._selectRows.find(_elem => _elem.textContent === label);
    return this.setSelected(elem || null);
  }
}


/**
 * Maintains the state of the user's keyed-in value when searching in the select element.
 */
class SelectKeyState<T> {
  private _term: string = "";
  private _cycleIndex: number = 0;
  private _timeoutId: NodeJS.Timeout|null = null;

  constructor(private _itemCallback: () => IOption<T>[]) {}

  // Adds a character to the search term. Returns the latest first match of the items, or null
  // if no items match.
  public add(char: string): IOptionFull<T>|null {
    // Filter out any keys that are not a single character. Make all searching case-insensitive.
    if (char.length > 1) { return null; }
    char = char.toLowerCase();

    // Clear the search term after a timeout. Any new entry should reset the timeout.
    if (this._timeoutId) { clearTimeout(this._timeoutId); }
    this._timeoutId = setTimeout(() => { this._term = ""; }, 1000);

    // Add character to the search term and look for a match. If a match is found, update the
    // observable value.
    if (this._term.length === 1 && char === this._term[0]) {
      // If the same character is pressed repeatedly, cycle through all options starting with
      // that character.
      this._cycleIndex += 1;
    } else {
      // Add character to the search term and reset the cycle search index.
      this._term += char;
      this._cycleIndex = 0;
    }
    const matches = this._itemCallback().filter(_item => {
      _item = getOptionFull(_item);
      return !_item.disabled && _item.label.toLowerCase().slice(0, this._term.length) === this._term;
    });
    if (matches.length > 0) {
      this._cycleIndex %= matches.length;
      return getOptionFull(matches[this._cycleIndex]);
    }
    return null;
  }
}

function stretchMenuToContainer(menuElem: HTMLElement, containerElem: Element): void {
  const style = menuElem.style;
  style.minWidth = containerElem.getBoundingClientRect().width + 'px';
  style.marginLeft = style.marginRight = '0';
}

function getOptionFull<T>(option: IOption<T>): IOptionFull<T> {
  return (typeof option === "string") ? {value: option, label: option} : (option as IOptionFull<T>);
}

const cssSelectBtn = styled('div', `
  position: relative;
  width: 100%;
  height: 30px;
  line-height: 30px;
  background-color: white;
  color: black;
  padding: 6px;
  border: 1px solid grey;
  border-radius: 3px;
  cursor: pointer;
  outline: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  display: flex;

  &:focus {
    outline: 5px auto #5E9ED6;
  }
`);
