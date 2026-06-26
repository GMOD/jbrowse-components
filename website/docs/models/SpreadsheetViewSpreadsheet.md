---
id: spreadsheetviewspreadsheet
title: SpreadsheetViewSpreadsheet
sidebar_label: View -> SpreadsheetViewSpreadsheet
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/SpreadsheetView/SpreadsheetModel.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SpreadsheetViewSpreadsheet.md)

## Overview

<details open>
<summary>SpreadsheetViewSpreadsheet - Properties</summary>

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

<details open>
<summary>SpreadsheetViewSpreadsheet - Volatiles</summary>

#### volatile: visibleRowFlags

```ts
// type signature
type visibleRowFlags = Record<number, boolean> | undefined
// code
visibleRowFlags: undefined as Record<number, boolean> | undefined
```

</details>

<details open>
<summary>SpreadsheetViewSpreadsheet - Getters</summary>

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

<details open>
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
