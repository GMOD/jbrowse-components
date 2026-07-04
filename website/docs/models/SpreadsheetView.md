---
id: spreadsheetview
title: SpreadsheetView
sidebar_label: View -> SpreadsheetView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`spreadsheet-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/SpreadsheetView/SpreadsheetViewModel.ts).

## Example usage

Hand-authored under `defaultSession.views`. The `init` shorthand loads a tabular
file (VCF/BED/CSV/etc) straight into the grid, skipping the import form;
`assembly` is used to resolve genomic coordinates in the rows:

```js
{
  type: 'SpreadsheetView',
  init: {
    assembly: 'hg38',
    uri: 'https://example.com/variants.vcf.gz',
    fileType: 'VCF',
  },
}
```

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

<details>
<summary>SpreadsheetView - Properties (other undocumented members)</summary>

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

</details>

<details>
<summary>SpreadsheetView - Volatiles</summary>

#### volatile: width

```ts
// type signature
type width = number
// code
width: 400
```

</details>

<details>
<summary>SpreadsheetView - Getters</summary>

#### getter: assembly

```ts
type assembly = any
```

</details>

<details>
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

#### action: displaySpreadsheet

load a new spreadsheet and set our mode to display it. When the incoming data
has the same columns as what's shown (i.e. a session-cached URI being re-fetched
on reload), carry over the user's column-visibility and SV-type filter — a fresh
parse only supplies columns/rowSet, so a plain replace would reset them. The
column match keeps this from leaking view state across different files.

```ts
type displaySpreadsheet = (spreadsheet?: ModelCreationType<ExtractCFromProps<{ rowSet: IType<RowSet | undefined, RowSet | undefined, RowSet | undefined>; columns: IType<{ name: string; }[], { name: string; }[], { name: string; }[]>; assemblyName: IMaybe<...>; visibleColumns: IOptionalIType<...>; svTypeFilter: IMaybe<...>; }>> | undefined) =>...
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

<details>
<summary>SpreadsheetView - Actions (other undocumented members)</summary>

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

#### action: setInit

```ts
type setInit = (init?: SpreadsheetViewInit | undefined) => void
```

</details>
