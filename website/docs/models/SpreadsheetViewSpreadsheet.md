---
id: spreadsheetviewspreadsheet
title: SpreadsheetViewSpreadsheet
sidebar_label: View -> SpreadsheetViewSpreadsheet
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`spreadsheet-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/SpreadsheetView/SpreadsheetModel.tsx).

## Overview

## Members

| Member                                         | Kind       | Defined by                 | Description                                                                                                                                 |
| ---------------------------------------------- | ---------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [rowSet](#property-rowset)                     | Properties | SpreadsheetViewSpreadsheet |                                                                                                                                             |
| [columns](#property-columns)                   | Properties | SpreadsheetViewSpreadsheet |                                                                                                                                             |
| [assemblyName](#property-assemblyname)         | Properties | SpreadsheetViewSpreadsheet |                                                                                                                                             |
| [visibleColumns](#property-visiblecolumns)     | Properties | SpreadsheetViewSpreadsheet |                                                                                                                                             |
| [svTypeFilter](#property-svtypefilter)         | Properties | SpreadsheetViewSpreadsheet | selected value of the SVTYPE quick-filter dropdown (undefined = show all); applied to the INFO.SVTYPE column when the imported data has one |
| [visibleRowFlags](#volatile-visiblerowflags)   | Volatiles  | SpreadsheetViewSpreadsheet |                                                                                                                                             |
| [rows](#getter-rows)                           | Getters    | SpreadsheetViewSpreadsheet |                                                                                                                                             |
| [initialized](#getter-initialized)             | Getters    | SpreadsheetViewSpreadsheet |                                                                                                                                             |
| [dataGridColumns](#getter-datagridcolumns)     | Getters    | SpreadsheetViewSpreadsheet |                                                                                                                                             |
| [visibleRows](#getter-visiblerows)             | Getters    | SpreadsheetViewSpreadsheet |                                                                                                                                             |
| [svTypeColumnField](#getter-svtypecolumnfield) | Getters    | SpreadsheetViewSpreadsheet | the SVTYPE column field name, present only for structural-variant VCFs (drives whether the SV-type quick-filter dropdown is shown)          |
| [svTypeOptions](#getter-svtypeoptions)         | Getters    | SpreadsheetViewSpreadsheet | the distinct SVTYPE values present in the data, sorted, for the quick-filter dropdown options                                               |
| [setVisibleRows](#action-setvisiblerows)       | Actions    | SpreadsheetViewSpreadsheet |                                                                                                                                             |
| [setSvTypeFilter](#action-setsvtypefilter)     | Actions    | SpreadsheetViewSpreadsheet |                                                                                                                                             |
| [setVisibleColumns](#action-setvisiblecolumns) | Actions    | SpreadsheetViewSpreadsheet |                                                                                                                                             |

<details>
<summary>SpreadsheetViewSpreadsheet - Properties</summary>

#### property: svTypeFilter

selected value of the SVTYPE quick-filter dropdown (undefined = show all);
applied to the INFO.SVTYPE column when the imported data has one

```ts
// type signature
type svTypeFilter = IMaybe<ISimpleType<string>>
// code
svTypeFilter: types.maybe(types.string)
```

</details>

<details>
<summary>SpreadsheetViewSpreadsheet - Properties (other undocumented members)</summary>

#### property: rowSet

```ts
// type signature
type rowSet = IType<RowSet | undefined, RowSet | undefined, RowSet | undefined>
// code
rowSet: types.frozen<RowSet | undefined>()
```

#### property: columns

```ts
// type signature
type columns = IType<{ name: string }[], { name: string }[], { name: string }[]>
// code
columns: types.frozen<{ name: string }[]>()
```

#### property: assemblyName

```ts
// type signature
type assemblyName = IMaybe<ISimpleType<string>>
// code
assemblyName: types.maybe(types.string)
```

#### property: visibleColumns

```ts
// type signature
type visibleColumns = IOptionalIType<
  IType<
    Record<string, boolean>,
    Record<string, boolean>,
    Record<string, boolean>
  >,
  [undefined]
>
// code
visibleColumns: types.optional(types.frozen<Record<string, boolean>>(), {})
```

</details>

<details>
<summary>SpreadsheetViewSpreadsheet - Volatiles</summary>

#### volatile: visibleRowFlags

```ts
// type signature
type visibleRowFlags = Record<number, boolean> | undefined
// code
visibleRowFlags: undefined as Record<number, boolean> | undefined
```

</details>

<details>
<summary>SpreadsheetViewSpreadsheet - Getters</summary>

#### getter: svTypeColumnField

the SVTYPE column field name, present only for structural-variant VCFs (drives
whether the SV-type quick-filter dropdown is shown)

```ts
type svTypeColumnField = string | undefined
```

#### getter: svTypeOptions

the distinct SVTYPE values present in the data, sorted, for the quick-filter
dropdown options

```ts
type svTypeOptions = string[]
```

</details>

<details>
<summary>SpreadsheetViewSpreadsheet - Getters (other undocumented members)</summary>

#### getter: rows

```ts
type rows = GridRow[] | undefined
```

#### getter: initialized

```ts
type initialized = boolean
```

#### getter: dataGridColumns

```ts
type dataGridColumns = ({ field: string; width: number; type: "number" | undefined; } | { field: string; width: number; renderCell: ({ row }: GridRenderCellParams<any, any, any, GridTreeNodeWithRender>) => Element | "N/A"; type?: undefined; valueGetter?: undefined; valueFormatter?: undefined; } | { ...; })[] | undefined
```

#### getter: visibleRows

```ts
type visibleRows = GridRow[] | undefined
```

</details>

<details>
<summary>SpreadsheetViewSpreadsheet - Actions</summary>

#### action: setVisibleRows

```ts
type setVisibleRows = (arg?: Record<number, boolean> | undefined) => void
```

#### action: setSvTypeFilter

```ts
type setSvTypeFilter = (arg?: string | undefined) => void
```

#### action: setVisibleColumns

```ts
type setVisibleColumns = (arg: Record<string, boolean>) => void
```

</details>
