import {dom, observable} from 'grainjs';

const clicks = observable(0);
const ddClicks = observable(0);

document.addEventListener('DOMContentLoaded', () => {
  dom.update(document.body,
    dom('section',
      dom('button#popup',
        dom.text((use) => `Popup (${use(clicks)})`),
        (dom as any).on('click', () => { clicks.set(clicks.get() + 1); }),
      ),
    ),
    dom('section',
      dom('button#dropdown',
        dom.text((use) => `Dropdown (${use(ddClicks)})`),
        (dom as any).on('click', () => { ddClicks.set(ddClicks.get() + 1); }),
      ),
    ),
  );
});
