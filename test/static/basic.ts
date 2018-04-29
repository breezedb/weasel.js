import {dom, observable} from 'grainjs';
import {tooltip} from '../..';

const clicks = observable(0);

document.addEventListener('DOMContentLoaded', () => {
  dom.update(document.body,
    dom('section',
      dom('button#popup',
        dom.text((use) => `Popup (${use(clicks)})`),
        dom.on('click', () => { clicks.set(clicks.get() + 1); }),
      ),
    ),
    dom('section',
      dom('button#tooltip', 'Tooltip',
        dom.on('click', (event, elem) => tooltip(elem, 'Hello')),
      ),
    ),
  );
});
