---
id: spreadsheetviewspreadsheet
title: SpreadsheetViewSpreadsheet
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/spreadsheet-view/src/SpreadsheetView/models/Spreadsheet.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/SpreadsheetView/models/Spreadsheet.ts)

### SpreadsheetViewSpreadsheet - Properties

#### property: columnDisplayOrder

```js
// type signature
IArrayType<ISimpleType<number>>
// code
columnDisplayOrder: types.array(types.number)
```

#### property: columns

```js
// type signature
IArrayType<IModelType<{ dataType: IOptionalIType<IAnyType, [undefined]>; derivationFunctionText: IMaybe<ISimpleType<string>>; isDerived: IType<boolean, boolean, boolean>; name: IMaybe<...>; }, { ...; }, _NotCustomized, _NotCustomized>>
// code
columns: types.array(ColumnDefinition)
```

#### property: hasColumnNames

```js
// type signature
false
// code
hasColumnNames: false
```

#### property: rowSet

```js
// type signature
IOptionalIType<IModelType<{ isLoaded: ISimpleType<true>; rows: IArrayType<IModelType<{ cells: IArrayType<IModelType<{ extendedData: IMaybe<IType<any, any, any>>; text: ISimpleType<string>; }, {}, _NotCustomized, _NotCustomized>>; extendedData: IMaybe<...>; id: ISimpleType<...>; isSelected: IType<...>; }, { ...; } & ...
// code
rowSet: types.optional(StaticRowSetModel, () => StaticRowSetModel.create())
```

#### property: sortColumns

```js
// type signature
IArrayType<IModelType<{ columnNumber: ISimpleType<number>; descending: IType<boolean, boolean, boolean>; }, { switchDirection(): void; }, _NotCustomized, _NotCustomized>>
// code
sortColumns: types.array(
      types
        .model('SortColumns', {
          columnNumber: types.number,
          descending: false,
        })
        .actions(self => ({
          switchDirection() {
            self.descending = !self.descending
          },
        })),
    )
```

### SpreadsheetViewSpreadsheet - Getters

#### getter: dataTypeChoices

list of data type names to be made available in the column dropdown menu

```js
// type
{
  categoryName: string
  displayName: string
  typeName: 'Text' | 'LocRef' | 'Number' | 'LocStart' | 'LocEnd' | 'LocString'
}
;[]
```

#### getter: hideRowSelection

```js
// type
any
```

#### getter: initialized

```js
// type
boolean
```

### SpreadsheetViewSpreadsheet - Methods

#### method: rowSortingComparisonFunction

```js
// type signature
rowSortingComparisonFunction: (rowA: { cells: IMSTArray<IModelType<{ extendedData: IMaybe<IType<any, any, any>>; text: ISimpleType<string>; }, {}, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>; extendedData: any; id: string; isSelected: boolean; } & NonEmptyObject & { ...; } & { ...; } & IStateTreeNode<...>, rowB: { ...; } & ... 3 more ...
```

### SpreadsheetViewSpreadsheet - Actions

#### action: setColumnType

```js
// type signature
setColumnType: (columnNumber: number, newTypeName: string) => void
```

#### action: setLoaded

```js
// type signature
setLoaded: (flag: boolean) => void
```

#### action: setRowMenuPosition

```js
// type signature
setRowMenuPosition: (newPosition: { anchorEl: Element; rowNumber: string; }) => void
```

#### action: setSortColumns

```js
// type signature
setSortColumns: (newSort: readonly ModelCreationType<ExtractCFromProps<{ columnNumber: ISimpleType<number>; descending: IType<boolean, boolean, boolean>; }>>[]) => void
```

#### action: unselectAll

```js
// type signature
unselectAll: () => void
```
