---
id: spreadsheetviewspreadsheet
title: SpreadsheetViewSpreadsheet
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

## Docs

### SpreadsheetViewSpreadsheet - Properties

#### property: rowSet

```js
// type signature
IType<RowSet, RowSet, RowSet>
// code
rowSet: types.frozen<RowSet | undefined>()
```

#### property: columns

```js
// type signature
IType<{ name: string; }[], { name: string; }[], { name: string; }[]>
// code
columns: types.frozen<{ name: string }[]>()
```

#### property: assemblyName

```js
// type signature
IMaybe<ISimpleType<string>>
// code
assemblyName: types.maybe(types.string)
```

#### property: visibleColumns

```js
// type signature
IType<Record<string, boolean>, Record<string, boolean>, Record<string, boolean>>
// code
visibleColumns: types.frozen<Record<string, boolean>>()
```

### SpreadsheetViewSpreadsheet - Getters

#### getter: rows

```js
// type
{
  id: number
  feature: SimpleFeatureSerialized
}
;[]
```

#### getter: initialized

```js
// type
boolean
```

#### getter: dataGridColumns

```js
// type
({ field: string; width: number; type: "number"; } | { field: string; width: number; renderCell: ({ row }: GridRenderCellParams<any, any, any, GridTreeNodeWithRender>) => Element | "N/A"; type?: undefined; valueGetter?: undefined; valueFormatter?: undefined; } | { ...; })[]
```

### SpreadsheetViewSpreadsheet - Actions

#### action: setVisibleRows

```js
// type signature
setVisibleRows: (arg?: Record<number, boolean>) => void
```

#### action: setVisibleColumns

```js
// type signature
setVisibleColumns: (arg: Record<string, boolean>) => void
```
