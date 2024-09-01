---
id: baseviewmodel
title: BaseViewModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/core/pluggableElementTypes/models/BaseViewModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/pluggableElementTypes/models/BaseViewModel.ts)

### BaseViewModel - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: displayName

displayName is displayed in the header of the view, or assembly names being used
if none is specified

```js
// type signature
IMaybe<ISimpleType<string>>
// code
displayName: types.maybe(types.string)
```

#### property: minimized

```js
// type signature
false
// code
minimized: false
```

### BaseViewModel - Getters

#### getter: menuItems

```js
// type
() => MenuItem[]
```

### BaseViewModel - Actions

#### action: setDisplayName

```js
// type signature
setDisplayName: (name: string) => void
```

#### action: setWidth

width is an important attribute of the view model, when it becomes set, it often
indicates when the app can start drawing to it. certain views like lgv are
strict about this because if it tries to draw before it knows the width it
should draw to, it may start fetching data for regions it doesn't need to

setWidth is updated by a ResizeObserver generally, the views often need to know
how wide they are to properly draw genomic regions

```js
// type signature
setWidth: (newWidth: number) => void
```

#### action: setMinimized

```js
// type signature
setMinimized: (flag: boolean) => void
```
