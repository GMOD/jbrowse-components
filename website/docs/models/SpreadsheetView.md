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

## Members

| Member                                                         | Kind       | Defined by                        | Description                                                                                             |
| -------------------------------------------------------------- | ---------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                         | Properties | SpreadsheetView                   |                                                                                                         |
| [offsetPx](#property-offsetpx)                                 | Properties | SpreadsheetView                   |                                                                                                         |
| [height](#property-height)                                     | Properties | SpreadsheetView                   |                                                                                                         |
| [hideVerticalResizeHandle](#property-hideverticalresizehandle) | Properties | SpreadsheetView                   |                                                                                                         |
| [hideFilterControls](#property-hidefiltercontrols)             | Properties | SpreadsheetView                   |                                                                                                         |
| [importWizard](#property-importwizard)                         | Properties | SpreadsheetView                   |                                                                                                         |
| [spreadsheet](#property-spreadsheet)                           | Properties | SpreadsheetView                   |                                                                                                         |
| [init](#property-init)                                         | Properties | SpreadsheetView                   | used for initializing the view from a session snapshot                                                  |
| [width](#volatile-width)                                       | Volatiles  | SpreadsheetView                   |                                                                                                         |
| [assembly](#getter-assembly)                                   | Getters    | SpreadsheetView                   |                                                                                                         |
| [menuItems](#method-menuitems)                                 | Methods    | SpreadsheetView                   |                                                                                                         |
| [setWidth](#action-setwidth)                                   | Actions    | SpreadsheetView                   |                                                                                                         |
| [setHeight](#action-setheight)                                 | Actions    | SpreadsheetView                   |                                                                                                         |
| [resizeHeight](#action-resizeheight)                           | Actions    | SpreadsheetView                   |                                                                                                         |
| [resizeWidth](#action-resizewidth)                             | Actions    | SpreadsheetView                   |                                                                                                         |
| [displaySpreadsheet](#action-displayspreadsheet)               | Actions    | SpreadsheetView                   | load a new spreadsheet and set our mode to display it.                                                  |
| [setInit](#action-setinit)                                     | Actions    | SpreadsheetView                   |                                                                                                         |
| [loadSpreadsheet](#action-loadspreadsheet)                     | Actions    | SpreadsheetView                   | the single load funnel: fetch+parse via the import wizard, then display the result.                     |
| [applyInit](#action-applyinit)                                 | Actions    | SpreadsheetView                   | apply a declarative init (from addView / sv-inspector): point the import wizard at the file and load it |
| [id](#property-id)                                             | Properties | [BaseViewModel](../baseviewmodel) |                                                                                                         |
| [displayName](#property-displayname)                           | Properties | [BaseViewModel](../baseviewmodel) | displayName is displayed in the header of the view, or assembly names being used if none is specified   |
| [minimized](#property-minimized)                               | Properties | [BaseViewModel](../baseviewmodel) |                                                                                                         |
| [setDisplayName](#action-setdisplayname)                       | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                         |
| [setMinimized](#action-setminimized)                           | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                         |

<details>
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

| Member                                                                       | Type                                                |
| ---------------------------------------------------------------------------- | --------------------------------------------------- |
| <span id="property-type">type</span>                                         | `ISimpleType<"SpreadsheetView">`                    |
| <span id="property-offsetpx">offsetPx</span>                                 | `IOptionalIType<ISimpleType<number>, [undefined]>`  |
| <span id="property-height">height</span>                                     | `IOptionalIType<ISimpleType<number>, [undefined]>`  |
| <span id="property-hideverticalresizehandle">hideVerticalResizeHandle</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |
| <span id="property-hidefiltercontrols">hideFilterControls</span>             | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |
| <span id="property-importwizard">importWizard</span>                         | `IOptionalIType<IModelType<…>, [...]>`              |
| <span id="property-spreadsheet">spreadsheet</span>                           | `IMaybe<IModelType<…>>`                             |

</details>

<details>
<summary>SpreadsheetView - Volatiles</summary>

| Member                                 | Type     |
| -------------------------------------- | -------- |
| <span id="volatile-width">width</span> | `number` |

</details>

<details>
<summary>SpreadsheetView - Getters</summary>

| Member                                     | Type  |
| ------------------------------------------ | ----- |
| <span id="getter-assembly">assembly</span> | `any` |

</details>

<details>
<summary>SpreadsheetView - Methods</summary>

| Member                                       | Type                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| <span id="method-menuitems">menuItems</span> | `() => { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; }[]` |

</details>

<details>
<summary>SpreadsheetView - Actions</summary>

#### action: displaySpreadsheet

load a new spreadsheet and set our mode to display it. When the incoming data
has the same columns as what's shown (i.e. a session-cached URI being re-fetched
on reload), carry over the user's column-visibility and SV-type filter — a fresh
parse only supplies columns/rowSet, so a plain replace would reset them. The
column match keeps this from leaking view state across different files.

```ts
type displaySpreadsheet = (spreadsheet?: ModelCreationType<ExtractCFromProps<…>> | undefined) => void
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

| Member                                             | Type                                                |
| -------------------------------------------------- | --------------------------------------------------- |
| <span id="action-setwidth">setWidth</span>         | `(newWidth: number) => number`                      |
| <span id="action-setheight">setHeight</span>       | `(newHeight: number) => number`                     |
| <span id="action-resizeheight">resizeHeight</span> | `(distance: number) => number`                      |
| <span id="action-resizewidth">resizeWidth</span>   | `(distance: number) => number`                      |
| <span id="action-setinit">setInit</span>           | `(init?: SpreadsheetViewInit \| undefined) => void` |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseViewModel</summary>

[BaseViewModel →](../baseviewmodel)

**Properties**

#### property: displayName

displayName is displayed in the header of the view, or assembly names being used
if none is specified

```ts
// type signature
type displayName = IMaybe<ISimpleType<string>>
// code
displayName: types.maybe(types.string)
```

| Member                                         | Type                                                |
| ---------------------------------------------- | --------------------------------------------------- |
| <span id="property-id">id</span>               | `IOptionalIType<ISimpleType<string>, [undefined]>`  |
| <span id="property-minimized">minimized</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |

**Actions**

| Member                                                 | Type                      |
| ------------------------------------------------------ | ------------------------- |
| <span id="action-setdisplayname">setDisplayName</span> | `(name: string) => void`  |
| <span id="action-setminimized">setMinimized</span>     | `(flag: boolean) => void` |

</details>
