---
id: snackbarmodel
title: SnackbarModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/ui/SnackbarModel.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SnackbarModel.md)

## Docs

### SnackbarModel - Getters

#### getter: snackbarMessageSet

```js
// type
Map<string, SnackbarMessage>
```

### SnackbarModel - Actions

#### action: notify

```js
// type signature
notify: (message: string, level?: NotificationLevel, action?: SnackAction) => void
```

#### action: notifyError

```js
// type signature
notifyError: (errorMessage: string, error?: unknown, extra?: unknown) => void
```

#### action: pushSnackbarMessage

```js
// type signature
pushSnackbarMessage: (message: string, level?: NotificationLevel, action?: SnackAction) => void
```

#### action: popSnackbarMessage

```js
// type signature
popSnackbarMessage: () => SnackbarMessage
```

#### action: removeSnackbarMessage

```js
// type signature
removeSnackbarMessage: (message: string) => void
```
