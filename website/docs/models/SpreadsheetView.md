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

#### property: filterControls

```js
// type signature
IOptionalIType<IModelType<{ columnFilters: IArrayType<IAnyType>; rowFullText: IOptionalIType<IModelType<{ stringToFind: IType<string, string, string>; type: ISimpleType<"RowFullText">; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
filterControls: types.optional(FilterControlsModel, () =>
      FilterControlsModel.create({}),
    )
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

#### property: hideFilterControls

```js
// type signature
false
// code
hideFilterControls: false
```

#### property: hideVerticalResizeHandle

```js
// type signature
false
// code
hideVerticalResizeHandle: false
```

#### property: importWizard

```js
// type signature
IOptionalIType<IModelType<{ columnNameLineNumber: IType<number, number, number>; fileType: IOptionalIType<ISimpleType<string>, [undefined]>; hasColumnNameLine: IType<...>; selectedAssemblyName: IMaybe<...>; }, { ...; } & ... 1 more ... & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
importWizard: types.optional(ImportWizardModel, () =>
      ImportWizardModel.create(),
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

#### property: offsetPx

```js
// type signature
number
// code
offsetPx: 0
```

#### property: spreadsheet

```js
// type signature
IMaybe<IModelType<{ assemblyName: IMaybe<ISimpleType<string>>; columnDisplayOrder: IArrayType<ISimpleType<number>>; columns: IArrayType<IModelType<{ dataType: IOptionalIType<...>; derivationFunctionText: IMaybe<...>; isDerived: IType<...>; name: IMaybe<...>; }, { ...; }, _NotCustomized, _NotCustomized>>; hasColumnNa...
// code
spreadsheet: types.maybe(SpreadsheetModel)
```

#### property: type

```js
// type signature
ISimpleType<"SpreadsheetView">
// code
type: types.literal('SpreadsheetView')
```

### SpreadsheetView - Getters

#### getter: assembly

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
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

#### getter: readyToDisplay

```js
// type
boolean
```

### SpreadsheetView - Methods

#### method: menuItems

```js
// type signature
menuItems: () => { icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; label: string; onClick: () => void; }[]
```

### SpreadsheetView - Actions

#### action: closeView

```js
// type signature
closeView: () => void
```

#### action: displaySpreadsheet

load a new spreadsheet and set our mode to display it

```js
// type signature
displaySpreadsheet: (spreadsheet: ModelCreationType<ExtractCFromProps<{ assemblyName: IMaybe<ISimpleType<string>>; columnDisplayOrder: IArrayType<ISimpleType<number>>; columns: IArrayType<IModelType<{ dataType: IOptionalIType<...>; derivationFunctionText: IMaybe<...>; isDerived: IType<...>; name: IMaybe<...>; }, { ...; }, _NotCustomize...
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

#### action: setDisplayMode

```js
// type signature
setDisplayMode: () => void
```

#### action: setHeight

```js
// type signature
setHeight: (newHeight: number) => number
```

#### action: setImportMode

```js
// type signature
setImportMode: () => void
```

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
