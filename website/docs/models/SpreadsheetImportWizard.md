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

## Overview

### SpreadsheetImportWizard - Properties

#### property: fileType

```js
// type signature
IOptionalIType<ISimpleType<"VCF" | "BED" | "BEDPE" | "STAR-Fusion">, [undefined]>
// code
fileType: types.stripDefault(types.enumeration(fileTypes), 'VCF')
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
IType<FileLocation | undefined, FileLocation | undefined, FileLocation | undefined>
// code
cachedFileLocation: types.frozen<FileLocation | undefined>()
```

### SpreadsheetImportWizard - Volatiles

#### volatile: fileSource

```js
// type signature
FileLocation | undefined
// code
fileSource: undefined as FileLocation | undefined
```

#### volatile: error

```js
// type signature
unknown
// code
error: undefined as unknown
```

#### volatile: loading

```js
// type signature
false
// code
loading: false
```

### SpreadsheetImportWizard - Getters

#### getter: isReadyToOpen

```js
// type
boolean
```

#### getter: fileName

```js
// type
string | undefined
```

### SpreadsheetImportWizard - Methods

#### method: tracksForAssembly

```js
// type signature
tracksForAssembly: (selectedAssembly: string) => { track: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; label: string; type: "VCF" | ... 2 more ... | "STAR-Fusion"; loc: FileLocation; }[]
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
setFileSource: (newSource: FileLocation | undefined) => void
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

#### action: setCachedFileHandle

```js
// type signature
setCachedFileHandle: (arg: FileLocation) => void
```

#### action: import

fetch and parse the file, returning a spreadsheet snapshot for the owning view
to display (the view owns displaySpreadsheet; this stays a pure fetch/parse with
no reach into the parent)

```js
// type signature
import: (assemblyName: string) => Promise<ModelCreationType<ExtractCFromProps<{ rowSet: IType<RowSet | undefined, RowSet | undefined, RowSet | undefined>; columns: IType<{ name: string; }[], { ...; }[], { ...; }[]>; assemblyName: IMaybe<...>; visibleColumns: IOptionalIType<...>; }>> | undefined>
```
