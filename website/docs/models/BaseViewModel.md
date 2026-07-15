---
id: baseviewmodel
title: BaseViewModel
sidebar_label: View -> BaseViewModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseViewModel.ts).

## Overview

## Members

| Member                                   | Kind       | Defined by    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | ---------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                       | Properties | BaseViewModel |                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [displayName](#property-displayname)     | Properties | BaseViewModel | displayName is displayed in the header of the view, or assembly names being used if none is specified                                                                                                                                                                                                                                                                                                                                               |
| [minimized](#property-minimized)         | Properties | BaseViewModel |                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [width](#volatile-width)                 | Volatiles  | BaseViewModel |                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [menuItems](#method-menuitems)           | Methods    | BaseViewModel |                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [setDisplayName](#action-setdisplayname) | Actions    | BaseViewModel |                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [setWidth](#action-setwidth)             | Actions    | BaseViewModel | width is an important attribute of the view model, when it becomes set, it often indicates when the app can start drawing to it. certain views like lgv are strict about this because if it tries to draw before it knows the width it should draw to, it may start fetching data for regions it doesn't need to setWidth is updated by a ResizeObserver generally, the views often need to know how wide they are to properly draw genomic regions |
| [setMinimized](#action-setminimized)     | Actions    | BaseViewModel |                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

<details>
<summary>BaseViewModel - Properties</summary>

#### property: displayName

displayName is displayed in the header of the view, or assembly names being used
if none is specified

```ts
// type signature
type displayName = IMaybe<ISimpleType<string>>
// code
displayName: types.maybe(types.string)
```

</details>

<details>
<summary>BaseViewModel - Properties (other undocumented members)</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: minimized

```ts
// type signature
type minimized = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
minimized: types.stripDefault(types.boolean, false)
```

</details>

<details>
<summary>BaseViewModel - Volatiles</summary>

#### volatile: width

```ts
// type signature
type width = number
// code
width: 800
```

</details>

<details>
<summary>BaseViewModel - Methods</summary>

#### method: menuItems

```ts
type menuItems = () => MenuItem[]
```

</details>

<details>
<summary>BaseViewModel - Actions</summary>

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

</details>

<details>
<summary>BaseViewModel - Actions (other undocumented members)</summary>

#### action: setDisplayName

```ts
type setDisplayName = (name: string) => void
```

#### action: setMinimized

```ts
type setMinimized = (flag: boolean) => void
```

</details>
