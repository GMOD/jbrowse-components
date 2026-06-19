---
id: spreadsheetimportwizard
title: SpreadsheetImportWizard
sidebar_label: View -> SpreadsheetImportWizard
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

<details open>
<summary>SpreadsheetImportWizard - Properties</summary>

#### property: fileType

```ts
// type signature
type fileType = IOptionalIType<
  ISimpleType<'VCF' | 'BED' | 'BEDPE' | 'STAR-Fusion'>,
  [undefined]
>
// code
fileType: types.stripDefault(types.enumeration(fileTypes), 'VCF')
```

#### property: selectedAssemblyName

```ts
// type signature
type selectedAssemblyName = IMaybe<ISimpleType<string>>
// code
selectedAssemblyName: types.maybe(types.string)
```

#### property: cachedFileLocation

used specifically for UriLocation's

```ts
// type signature
type cachedFileLocation = IType<
  FileLocation | undefined,
  FileLocation | undefined,
  FileLocation | undefined
>
// code
cachedFileLocation: types.frozen<FileLocation | undefined>()
```

</details>

<details open>
<summary>SpreadsheetImportWizard - Volatiles</summary>

#### volatile: fileSource

```ts
// type signature
type fileSource = FileLocation | undefined
// code
fileSource: undefined as FileLocation | undefined
```

#### volatile: error

```ts
// type signature
type error = unknown
// code
error: undefined as unknown
```

#### volatile: loading

```ts
// type signature
type loading = false
// code
loading: false
```

</details>

<details open>
<summary>SpreadsheetImportWizard - Getters</summary>

#### getter: isReadyToOpen

```ts
type isReadyToOpen = boolean
```

#### getter: fileName

```ts
type fileName = string | undefined
```

</details>

<details open>
<summary>SpreadsheetImportWizard - Methods</summary>

#### method: tracksForAssembly

```ts
type tracksForAssembly = (selectedAssembly: string) => { track: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; label: string; type: "VCF" | ... 2 more ... | "STAR-Fusion"; loc: FileLocation; }[]
```

</details>

<details open>
<summary>SpreadsheetImportWizard - Actions</summary>

#### action: setSelectedAssemblyName

```ts
type setSelectedAssemblyName = (s: string) => void
```

#### action: setFileSource

```ts
type setFileSource = (newSource: FileLocation | undefined) => void
```

#### action: setFileType

```ts
type setFileType = (typeName: string) => void
```

#### action: setError

```ts
type setError = (error: unknown) => void
```

#### action: setLoading

```ts
type setLoading = (arg: boolean) => void
```

#### action: setCachedFileHandle

```ts
type setCachedFileHandle = (arg: FileLocation) => void
```

#### action: import

fetch and parse the file, returning a spreadsheet snapshot for the owning view
to display (the view owns displaySpreadsheet; this stays a pure fetch/parse with
no reach into the parent)

```ts
type import = (assemblyName: string) => Promise<ModelCreationType<ExtractCFromProps<{ rowSet: IType<RowSet | undefined, RowSet | undefined, RowSet | undefined>; columns: IType<{ name: string; }[], { ...; }[], { ...; }[]>; assemblyName: IMaybe<...>; visibleColumns: IOptionalIType<...>; }>> | undefined>
```

</details>
