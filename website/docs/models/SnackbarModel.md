---
id: snackbarmodel
title: SnackbarModel
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Docs

### SnackbarModel - Getters

#### getter: snackbarMessages

```js
// type
IObservableArray<any>
```

### SnackbarModel - Actions

#### action: notify

```js
// type signature
notify: (message: string, level?: NotificationLevel, action?: SnackAction) => void
```

#### action: pushSnackbarMessage

```js
// type signature
pushSnackbarMessage: (
  message: string,
  level?: NotificationLevel,
  action?: SnackAction,
) => number
```

#### action: popSnackbarMessage

```js
// type signature
popSnackbarMessage: () => any
```

#### action: removeSnackbarMessage

```js
// type signature
removeSnackbarMessage: (message: string) => void
```
