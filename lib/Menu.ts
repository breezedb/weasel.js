import { IDOMContent } from './popup';

interface IMenuItem {
  name: string;
  action: () => void | IMenuItem[];
}

export class Menu implements IDOMContent {
  private items: IMenuItem[];

  constructor(items: IMenuItem[]) {
    this.items = items;
  }

  public getDOM(): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = `
      <ul>
        ${this.items.map((item) => `<li>${item.name}</li>`).join('\n')}
      </ul>
    `;
    return el;
  }
}
