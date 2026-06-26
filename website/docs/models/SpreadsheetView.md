---
id: spreadsheetview
title: SpreadsheetView
sidebar_label: View -> SpreadsheetView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/SpreadsheetView/SpreadsheetViewModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SpreadsheetView.md)

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseViewModel](../baseviewmodel)

**Properties:** [id](../baseviewmodel#property-id),
[displayName](../baseviewmodel#property-displayname),
[minimized](../baseviewmodel#property-minimized)

**Volatiles:** [width](../baseviewmodel#volatile-width)

**Getters:** [menuItems](../baseviewmodel#getter-menuitems)

**Actions:** [setDisplayName](../baseviewmodel#action-setdisplayname),
[setWidth](../baseviewmodel#action-setwidth),
[setMinimized](../baseviewmodel#action-setminimized)

<details open>
<summary>SpreadsheetView - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'SpreadsheetView'>
// code
type: types.literal('SpreadsheetView')
```

#### property: offsetPx

```ts
// type signature
type offsetPx = IOptionalIType<ISimpleType<number>, [undefined]>
// code
offsetPx: types.stripDefault(types.number, 0)
```

#### property: height

```ts
// type signature
type height = IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.stripDefault(types.number, defaultHeight)
```

#### property: hideVerticalResizeHandle

```ts
// type signature
type hideVerticalResizeHandle = IOptionalIType<
  ISimpleType<boolean>,
  [undefined]
>
// code
hideVerticalResizeHandle: types.stripDefault(types.boolean, false)
```

#### property: hideFilterControls

```ts
// type signature
type hideFilterControls = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
hideFilterControls: types.stripDefault(types.boolean, false)
```

#### property: importWizard

```ts
// type signature
type importWizard = IOptionalIType<IModelType<{ fileType: IOptionalIType<ISimpleType<"VCF" | "BED" | "BEDPE" | "STAR-Fusion">, [undefined]>; selectedAssemblyName: IMaybe<ISimpleType<string>>; cachedFileLocation: IType<...>; }, { ...; } & ... 2 more ... & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
importWizard: types.optional(ImportWizardModel, () =>
            ImportWizardModel.create(),
          )
```

#### property: spreadsheet

```ts
// type signature
type spreadsheet = IMaybe<IModelType<{ rowSet: IType<RowSet | undefined, RowSet | undefined, RowSet | undefined>; columns: IType<{ name: string; }[], { name: string; }[], { name: string; }[]>; assemblyName: IMaybe<...>; visibleColumns: IOptionalIType<...>; svTypeFilter: IMaybe<...>; }, { ...; } & ... 3 more ... & { ...; }, _NotCustomi...
// code
spreadsheet: types.maybe(Spreadsheet())
```

#### property: init

used for initializing the view from a session snapshot

```ts
// type signature
type init = IType<
  SpreadsheetViewInit | undefined,
  SpreadsheetViewInit | undefined,
  SpreadsheetViewInit | undefined
>
// code
init: types.frozen<SpreadsheetViewInit | undefined>()
```

</details>

<details open>
<summary>SpreadsheetView - Volatiles</summary>

#### volatile: width

```ts
// type signature
type width = number
// code
width: 400
```

</details>

<details open>
<summary>SpreadsheetView - Getters</summary>

#### getter: assembly

```ts
type assembly = any
```

</details>

<details open>
<summary>SpreadsheetView - Methods</summary>

#### method: menuItems

```ts
type menuItems = () => {
  label: string
  icon: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & { muiName: string }
  onClick: () => void
}[]
```

</details>

<details open>
<summary>SpreadsheetView - Actions</summary>

#### action: setWidth

```ts
type setWidth = (newWidth: number) => number
```

#### action: setHeight

```ts
type setHeight = (newHeight: number) => number
```

#### action: resizeHeight

```ts
type resizeHeight = (distance: number) => number
```

#### action: resizeWidth

```ts
type resizeWidth = (distance: number) => number
```

#### action: displaySpreadsheet

load a new spreadsheet and set our mode to display it

```ts
type displaySpreadsheet = (spreadsheet?: ModelCreationType<ExtractCFromProps<{ rowSet: IType<RowSet | undefined, RowSet | undefined, RowSet | undefined>; columns: IType<{ name: string; }[], { name: string; }[], { name: string; }[]>; assemblyName: IMaybe<...>; visibleColumns: IOptionalIType<...>; svTypeFilter: IMaybe<...>; }>> | undefined) =>...
```

#### action: setInit

```ts
type setInit = (init?: SpreadsheetViewInit | undefined) => void
```

#### action: loadSpreadsheet

the single load funnel: fetch+parse via the import wizard, then display the
result. Every entry point (declarative init, cached reload, the import form's
Open button) routes through here so the view stays the sole owner of
displaySpreadsheet

```ts
type loadSpreadsheet = (assemblyName: string) => Promise<void>
```

#### action: applyInit

apply a declarative init (from addView / sv-inspector): point the import wizard
at the file and load it

```ts
type applyInit = (init: SpreadsheetViewInit) => Promise<void>
```

</details>
