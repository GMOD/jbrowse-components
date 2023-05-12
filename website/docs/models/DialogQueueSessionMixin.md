---
id: dialogqueuesessionmixin
title: DialogQueueSessionMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/product-core/src/Session/DialogQueue.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/DialogQueue.ts)

### DialogQueueSessionMixin - Getters

#### getter: DialogComponent

```js
// type
any
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
queueDialog: (cb: (doneCallback: () => void) => [any, unknown]) => void
```
