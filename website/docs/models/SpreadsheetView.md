---
id: spreadsheetview
title: SpreadsheetView
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/spreadsheet-view/src/SpreadsheetView/models/SpreadsheetView.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/SpreadsheetView/models/SpreadsheetView.ts)

### SpreadsheetView - Properties

#### property: type

```js
// type signature
ISimpleType<"SpreadsheetView">
// code
type: types.literal('SpreadsheetView')
```

#### property: offsetPx

```js
// type signature
number
// code
offsetPx: 0
```

#### property: height

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.optional(
      types.refinement(
        'SpreadsheetViewHeight',
        types.number,
        n => n >= minHeight,
      ),
      defaultHeight,
    )
```

#### property: hideVerticalResizeHandle

```js
// type signature
false
// code
hideVerticalResizeHandle: false
```

#### property: hideFilterControls

```js
// type signature
false
// code
hideFilterControls: false
```

#### property: filterControls

```js
// type signature
IOptionalIType<IModelType<{ rowFullText: IOptionalIType<IModelType<{ type: ISimpleType<"RowFullText">; stringToFind: IType<string, string, string>; }, { readonly predicate: (_sheet: unknown, row: { cellsWithDerived: { text: string; }[]; }) => boolean; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>; columnFilt...
// code
filterControls: types.optional(FilterControlsModel, () =>
      FilterControlsModel.create({}),
    )
```

#### property: mode

switch specifying whether we are showing the import wizard or the spreadsheet in
our viewing area

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
mode: types.optional(
      types.enumeration('SpreadsheetViewMode', ['import', 'display']),
      'import',
    )
```

#### property: importWizard

```js
// type signature
IOptionalIType<IModelType<{ fileType: IOptionalIType<ISimpleType<string>, [undefined]>; hasColumnNameLine: IType<boolean, boolean, boolean>; columnNameLineNumber: IType<...>; selectedAssemblyName: IMaybe<...>; }, { ...; } & ... 1 more ... & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
importWizard: types.optional(ImportWizardModel, () =>
      ImportWizardModel.create(),
    )
```

#### property: spreadsheet

```js
// type signature
IMaybe<IModelType<{ rowSet: IOptionalIType<IModelType<{ isLoaded: ISimpleType<true>; rows: IArrayType<IModelType<{ id: ISimpleType<string>; cells: IArrayType<IModelType<{ text: ISimpleType<string>; extendedData: IMaybe<IType<any, any, any>>; }, {}, _NotCustomized, _NotCustomized>>; extendedData: IMaybe<...>; isSelec...
// code
spreadsheet: types.maybe(SpreadsheetModel)
```

### SpreadsheetView - Getters

#### getter: readyToDisplay

```js
// type
boolean
```

#### getter: hideRowSelection

```js
// type
boolean
```

#### getter: outputRows

```js
// type
any
```

#### getter: assembly

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>
```

### SpreadsheetView - Methods

#### method: menuItems

```js
// type signature
menuItems: () => { label: string; onClick: () => void; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; }[]
```

### SpreadsheetView - Actions

#### action: setRowMenuItems

```js
// type signature
setRowMenuItems: (newItems: MenuItem[]) => void
```

#### action: setWidth

```js
// type signature
setWidth: (newWidth: number) => number
```

#### action: setHeight

```js
// type signature
setHeight: (newHeight: number) => number
```

#### action: resizeHeight

```js
// type signature
resizeHeight: (distance: number) => number
```

#### action: resizeWidth

```js
// type signature
resizeWidth: (distance: number) => number
```

#### action: displaySpreadsheet

load a new spreadsheet and set our mode to display it

```js
// type signature
displaySpreadsheet: (spreadsheet: ModelCreationType<ExtractCFromProps<{ rowSet: IOptionalIType<IModelType<{ isLoaded: ISimpleType<true>; rows: IArrayType<IModelType<{ id: ISimpleType<string>; cells: IArrayType<IModelType<{ text: ISimpleType<string>; extendedData: IMaybe<...>; }, {}, _NotCustomized, _NotCustomized>>; extendedData: IMayb...
```

#### action: setImportMode

```js
// type signature
setImportMode: () => void
```

#### action: setDisplayMode

```js
// type signature
setDisplayMode: () => void
```
