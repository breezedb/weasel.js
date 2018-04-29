# weasel.js
Collection of UI elements that behave as popovers

## Static Menus

For simple menus, create a single instance of Menu, and reuse it for potentially many open/close
calls. This is a good and simple pattern for a static menu.

```typescript
const menu = new Menu(...);
popupOpen(triggerElem, menu, options);
```

## Dynamic menus

You can create a new Menu instance on every open, and destroy it on close. This should be
preferred if the menu changes depending on context, or if its content subscribes
to outside changes (which is wasteful when the menu is not shown).

```typescript
popupCreate(triggerElem, () => new Menu(...), options);
```

## Existing DOM as a popup

You can use an existing DOM element to attach/detach on open/close, e.g. a tooltip:

```typescript
const myDom = document.querySelector('.my-tooltip');
popupElem(triggerElem, myDom, options);
```

## Custom popup class

You can define a custom popup class. It can then be used for either the static or dynamic usage pattern.

```typescript
class SpecialMenu implements IPopupContentDisposable {
  constructor() { ... }
  openPopup(elem, ctl) { ... };
  closePopup() { ... };
  destroyPopup() { ... }  // Only needed for dynamic usage.
}

// Calls .openPopup() on open, .closePopup() on close.
popupOpen(triggerElem, new SpecialMenu(...), options);

// Calls constructor and .openPopup() on open; .closePopup() and .destroyPopup() on close.
popupCreate(triggerElem, () => new SpecialMenu(...), options);
```

## Low-level interface.

You can use a low-level function-based interface to create a custom popup. It's the basis
for all the more convenient interfaces above, and you may use it e.g. to create
adapters for other libraries. See popupFunc() documentation for an example.

```typescript
popupFunc(triggerElem, (elem, ctl) => {
  elem.appendChild(...);
  return () => { ...dispose... };
}, options);
```
