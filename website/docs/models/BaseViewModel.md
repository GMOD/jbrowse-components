---
id: baseviewmodel
title: BaseViewModel
sidebar_label: View -> BaseViewModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseViewModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseViewModel.md)

## Overview

<details open>
<summary>BaseViewModel - Properties</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: displayName

displayName is displayed in the header of the view, or assembly names being used
if none is specified

```ts
// type signature
type displayName = IMaybe<ISimpleType<string>>
// code
displayName: types.maybe(types.string)
```

#### property: minimized

```ts
// type signature
type minimized = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
minimized: types.stripDefault(types.boolean, false)
```

</details>

<details open>
<summary>BaseViewModel - Volatiles</summary>

#### volatile: width

```ts
// type signature
type width = number
// code
width: 800
```

</details>

<details open>
<summary>BaseViewModel - Getters</summary>

#### getter: menuItems

```ts
type menuItems = () => MenuItem[]
```

</details>

<details open>
<summary>BaseViewModel - Actions</summary>

#### action: setDisplayName

```ts
type setDisplayName = (name: string) => void
```

#### action: setWidth

width is an important attribute of the view model, when it becomes set, it often
indicates when the app can start drawing to it. certain views like lgv are
strict about this because if it tries to draw before it knows the width it
should draw to, it may start fetching data for regions it doesn't need to

setWidth is updated by a ResizeObserver generally, the views often need to know
how wide they are to properly draw genomic regions

```ts
type setWidth = (newWidth: number) => void
```

#### action: setMinimized

```ts
type setMinimized = (flag: boolean) => void
```

</details>
