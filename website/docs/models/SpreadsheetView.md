---
id: spreadsheetview
title: SpreadsheetView
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

## Docs

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
height: types.optional(types.number, defaultHeight)
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

#### property: importWizard

```js
// type signature
IOptionalIType<IModelType<{ fileType: IOptionalIType<ISimpleType<string>, [undefined]>; hasColumnNameLine: IType<boolean, boolean, boolean>; columnNameLineNumber: IType<...>; selectedAssemblyName: IMaybe<...>; cachedFileLocation: IType<...>; }, { ...; } & ... 3 more ... & { ...; }, _NotCustomized, _NotCustomized>, [...
// code
importWizard: types.optional(ImportWizardModel, () =>
            ImportWizardModel.create(),
          )
```

#### property: spreadsheet

```js
// type signature
IMaybe<IModelType<{ rowSet: IType<RowSet, RowSet, RowSet>; columns: IType<{ name: string; }[], { name: string; }[], { name: string; }[]>; assemblyName: IMaybe<ISimpleType<string>>; visibleColumns: IType<...>; }, { ...; } & ... 3 more ... & { ...; }, ModelCreationType<...>, _NotCustomized>>
// code
spreadsheet: types.maybe(Spreadsheet())
```

#### property: init

used for initializing the view from a session snapshot

```js
// type signature
IType<SpreadsheetViewInit, SpreadsheetViewInit, SpreadsheetViewInit>
// code
init: types.frozen<SpreadsheetViewInit | undefined>()
```

### SpreadsheetView - Getters

#### getter: assembly

```js
// type
any
```

### SpreadsheetView - Methods

#### method: menuItems

```js
// type signature
menuItems: () => { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; }[]
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
displaySpreadsheet: (spreadsheet?: { rowSet: RowSet & IStateTreeNode<IType<RowSet, RowSet, RowSet>>; columns: { name: string; }[] & IStateTreeNode<IType<{ name: string; }[], { ...; }[], { ...; }[]>>; assemblyName: string; visibleColumns: Record<...> & IStateTreeNode<...>; } & ... 6 more ... & IStateTreeNode<...>) => void
```

#### action: setInit

```js
// type signature
setInit: (init?: SpreadsheetViewInit) => void
```
