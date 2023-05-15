---
id: spreadsheetimportwizard
title: SpreadsheetImportWizard
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/spreadsheet-view/src/SpreadsheetView/models/ImportWizard.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/SpreadsheetView/models/ImportWizard.ts)

### SpreadsheetImportWizard - Properties

#### property: fileType

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
fileType: types.optional(types.enumeration(fileTypes), 'CSV')
```

#### property: hasColumnNameLine

```js
// type signature
true
// code
hasColumnNameLine: true
```

#### property: columnNameLineNumber

```js
// type signature
number
// code
columnNameLineNumber: 1
```

#### property: selectedAssemblyName

```js
// type signature
IMaybe<ISimpleType<string>>
// code
selectedAssemblyName: types.maybe(types.string)
```
