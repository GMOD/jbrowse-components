---
id: dialogqueuesessionmixin
title: DialogQueueSessionMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/DialogQueue.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/DialogQueueSessionMixin.md)

## Docs

### DialogQueueSessionMixin - Getters

#### getter: DialogComponent

```js
// type
DialogComponentType
```

#### getter: DialogProps

```js
// type
unknown
```

### DialogQueueSessionMixin - Actions

#### action: removeActiveDialog

```js
// type signature
removeActiveDialog: () => void
```

#### action: queueDialog

```js
// type signature
queueDialog: (cb: (doneCallback: () => void) => [DialogComponentType, unknown]) => void
```
