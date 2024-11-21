---
id: appfocusmixin
title: AppFocusMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/app-core/src/AppFocus/index.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/AppFocus/index.ts)

### AppFocusMixin - Properties

#### property: focusedViewId

used to keep track of which view is in focus

```js
// type signature
IMaybe<ISimpleType<string>>
// code
focusedViewId: types.maybe(types.string)
```

### AppFocusMixin - Actions

#### action: setFocusedViewId

```js
// type signature
setFocusedViewId: (viewId: string) => void
```
