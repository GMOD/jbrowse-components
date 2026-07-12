---
id: spreadsheetimportwizard
title: SpreadsheetImportWizard
sidebar_label: View -> SpreadsheetImportWizard
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`spreadsheet-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/SpreadsheetView/ImportWizard.ts).

## Overview

## Members

| Member                                                     | Kind       | Defined by              | Description                                                                                                                                                                               |
| ---------------------------------------------------------- | ---------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [fileType](#property-filetype)                             | Properties | SpreadsheetImportWizard |                                                                                                                                                                                           |
| [selectedAssemblyName](#property-selectedassemblyname)     | Properties | SpreadsheetImportWizard |                                                                                                                                                                                           |
| [cachedFileLocation](#property-cachedfilelocation)         | Properties | SpreadsheetImportWizard | used specifically for UriLocation's                                                                                                                                                       |
| [fileSource](#volatile-filesource)                         | Volatiles  | SpreadsheetImportWizard |                                                                                                                                                                                           |
| [error](#volatile-error)                                   | Volatiles  | SpreadsheetImportWizard |                                                                                                                                                                                           |
| [loading](#volatile-loading)                               | Volatiles  | SpreadsheetImportWizard |                                                                                                                                                                                           |
| [isReadyToOpen](#getter-isreadytoopen)                     | Getters    | SpreadsheetImportWizard |                                                                                                                                                                                           |
| [fileName](#getter-filename)                               | Getters    | SpreadsheetImportWizard |                                                                                                                                                                                           |
| [tracksForAssembly](#method-tracksforassembly)             | Methods    | SpreadsheetImportWizard |                                                                                                                                                                                           |
| [setSelectedAssemblyName](#action-setselectedassemblyname) | Actions    | SpreadsheetImportWizard |                                                                                                                                                                                           |
| [setFileSource](#action-setfilesource)                     | Actions    | SpreadsheetImportWizard |                                                                                                                                                                                           |
| [setFileType](#action-setfiletype)                         | Actions    | SpreadsheetImportWizard |                                                                                                                                                                                           |
| [setError](#action-seterror)                               | Actions    | SpreadsheetImportWizard |                                                                                                                                                                                           |
| [setLoading](#action-setloading)                           | Actions    | SpreadsheetImportWizard |                                                                                                                                                                                           |
| [setCachedFileHandle](#action-setcachedfilehandle)         | Actions    | SpreadsheetImportWizard |                                                                                                                                                                                           |
| [selectDefaultTrack](#action-selectdefaulttrack)           | Actions    | SpreadsheetImportWizard | point the source/type at the first usable track for an assembly (or clear if none), used to seed the "open from track" flow                                                               |
| [import](#action-import)                                   | Actions    | SpreadsheetImportWizard | fetch and parse the file, returning a spreadsheet snapshot for the owning view to display (the view owns displaySpreadsheet; this stays a pure fetch/parse with no reach into the parent) |

<details>
<summary>SpreadsheetImportWizard - Properties</summary>

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

<details>
<summary>SpreadsheetImportWizard - Properties (other undocumented members)</summary>

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

</details>

<details>
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

<details>
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

<details>
<summary>SpreadsheetImportWizard - Methods</summary>

#### method: tracksForAssembly

```ts
type tracksForAssembly = (selectedAssembly: string) => { track: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; label: string; type: "VCF" | ... 2 more ... | "STAR-Fusion"; loc: FileLocation; }[]
```

</details>

<details>
<summary>SpreadsheetImportWizard - Actions</summary>

#### action: selectDefaultTrack

point the source/type at the first usable track for an assembly (or clear if
none), used to seed the "open from track" flow

```ts
type selectDefaultTrack = (assembly: string) => void
```

#### action: import

fetch and parse the file, returning a spreadsheet snapshot for the owning view
to display (the view owns displaySpreadsheet; this stays a pure fetch/parse with
no reach into the parent)

```ts
type import = (assemblyName: string) => Promise<ModelCreationType<ExtractCFromProps<{ rowSet: IType<RowSet | undefined, RowSet | undefined, RowSet | undefined>; columns: IType<{ name: string; }[], { ...; }[], { ...; }[]>; assemblyName: IMaybe<...>; visibleColumns: IOptionalIType<...>; svTypeFilter: IMaybe<...>; }>> | undefined>
```

</details>

<details>
<summary>SpreadsheetImportWizard - Actions (other undocumented members)</summary>

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

</details>
