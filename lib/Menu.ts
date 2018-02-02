import {dom} from 'grainjs';
import { IDOMContent } from './popup';

interface IMenuItem {
  name: string;
  color?: string;
  action: () => void | IMenuItem[];
}

export class Menu implements IDOMContent {
  private items: IMenuItem[];

  constructor(items: IMenuItem[]) {
    this.items = items;
  }

  public getDOM(): HTMLElement {
    return dom('div',
      dom('ul',
        this.items.map((item) =>
          dom('li',
            dom.style('color', item.color || 'red'),
            item.name))));
  }
}
