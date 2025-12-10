---
id: spreadsheetimportwizard
title: SpreadsheetImportWizard
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/SpreadsheetView/ImportWizard.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SpreadsheetImportWizard.md)

## Docs

### SpreadsheetImportWizard - Properties

#### property: fileType

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
fileType: types.optional(types.enumeration(fileTypes), 'VCF')
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

#### property: cachedFileLocation

used specifically for UriLocation's

```js
// type signature
IType<FileLocation, FileLocation, FileLocation>
// code
cachedFileLocation: types.frozen<FileLocation | undefined>()
```

### SpreadsheetImportWizard - Getters

#### getter: isReadyToOpen

```js
// type
any
```

#### getter: fileName

```js
// type
any
```

#### getter: requiresUnzip

```js
// type
any
```

### SpreadsheetImportWizard - Methods

#### method: isValidRefName

```js
// type signature
isValidRefName: (refName: string, assemblyName?: string) => boolean
```

#### method: tracksForAssembly

```js
// type signature
tracksForAssembly: (selectedAssembly: string) => { track: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ ...; } & ... 2 more ... & IStateTreeNode<...>); } & IStateTreeNode<...>; label: string; assemblyNames: any; type: string; loc: FileLocation; }[]
```

### SpreadsheetImportWizard - Actions

#### action: setSelectedAssemblyName

```js
// type signature
setSelectedAssemblyName: (s: string) => void
```

#### action: setFileSource

```js
// type signature
setFileSource: (newSource: unknown) => void
```

#### action: setColumnNameLineNumber

```js
// type signature
setColumnNameLineNumber: (newnumber: number) => void
```

#### action: setFileType

```js
// type signature
setFileType: (typeName: string) => void
```

#### action: setError

```js
// type signature
setError: (error: unknown) => void
```

#### action: setLoading

```js
// type signature
setLoading: (arg: boolean) => void
```

#### action: cancelButton

```js
// type signature
cancelButton: () => void
```

#### action: setCachedFileHandle

```js
// type signature
setCachedFileHandle: (arg: FileLocation) => void
```

#### action: import

fetch and parse the file, make a new Spreadsheet model for it, then set the
parent to display it

```js
// type signature
import: (assemblyName: string) => Promise<void>
```
