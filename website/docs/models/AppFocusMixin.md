---
id: appfocusmixin
title: AppFocusMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/AppFocus/index.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/AppFocusMixin.md)

## Docs

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
