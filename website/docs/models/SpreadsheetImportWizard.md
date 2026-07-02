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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                   | Signature                                                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`fileType`](#property-filetype)                         | `IOptionalIType<ISimpleType<"VCF" \| "BED" \| "BEDPE" \| "STAR-Fusion">, [undefined]>` |
| [`selectedAssemblyName`](#property-selectedassemblyname) | `IMaybe<ISimpleType<string>>`                                                          |

</details>

<details>
<summary>SpreadsheetImportWizard - Properties (all signatures)</summary>

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

<details open>
<summary>SpreadsheetImportWizard - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                               | Signature                   |
| ------------------------------------ | --------------------------- |
| [`fileSource`](#volatile-filesource) | `FileLocation \| undefined` |
| [`error`](#volatile-error)           | `unknown`                   |
| [`loading`](#volatile-loading)       | `false`                     |

</details>

<details>
<summary>SpreadsheetImportWizard - Volatiles (all signatures)</summary>

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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                   | Signature             |
| ---------------------------------------- | --------------------- |
| [`isReadyToOpen`](#getter-isreadytoopen) | `boolean`             |
| [`fileName`](#getter-filename)           | `string \| undefined` |

</details>

<details>
<summary>SpreadsheetImportWizard - Getters (all signatures)</summary>

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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                           | Signature                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`tracksForAssembly`](#method-tracksforassembly) | `(selectedAssembly: string) => { track: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; label: string; type: "VCF" \| ... 2 more ... \| "STAR-Fusion"; loc: FileLocation; }[]` |

</details>

<details>
<summary>SpreadsheetImportWizard - Methods (all signatures)</summary>

#### method: tracksForAssembly

```ts
type tracksForAssembly = (selectedAssembly: string) => { track: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>; label: string; type: "VCF" | ... 2 more ... | "STAR-Fusion"; loc: FileLocation; }[]
```

</details>

<details open>
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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                       | Signature                                        |
| ------------------------------------------------------------ | ------------------------------------------------ |
| [`setSelectedAssemblyName`](#action-setselectedassemblyname) | `(s: string) => void`                            |
| [`setFileSource`](#action-setfilesource)                     | `(newSource: FileLocation \| undefined) => void` |
| [`setFileType`](#action-setfiletype)                         | `(typeName: string) => void`                     |
| [`setError`](#action-seterror)                               | `(error: unknown) => void`                       |
| [`setLoading`](#action-setloading)                           | `(arg: boolean) => void`                         |
| [`setCachedFileHandle`](#action-setcachedfilehandle)         | `(arg: FileLocation) => void`                    |

</details>

<details>
<summary>SpreadsheetImportWizard - Actions (all signatures)</summary>

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
