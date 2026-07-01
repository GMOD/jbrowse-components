---
id: addtrackmodel
title: AddTrackModel
sidebar_label: Widget -> AddTrackModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/AddTrackWidget/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/AddTrackModel.md)

## Overview

<details open>
<summary>AddTrackModel - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                   | Signature                                          |
| ------------------------ | -------------------------------------------------- |
| [`id`](#property-id)     | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| [`type`](#property-type) | `ISimpleType<"AddTrackWidget">`                    |
| [`view`](#property-view) | `IMaybe<IReferenceType<IAnyType>>`                 |

</details>

<details>
<summary>AddTrackModel - Properties (all signatures)</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```ts
// type signature
type type = ISimpleType<'AddTrackWidget'>
// code
type: types.literal('AddTrackWidget')
```

#### property: view

```ts
// type signature
type view = IMaybe<IReferenceType<IAnyType>>
// code
view: types.safeReference(pluginManager.pluggableMstType('view', 'stateModel'))
```

</details>

<details open>
<summary>AddTrackModel - Getters</summary>

#### getter: adapterHintNotConfigurable

Returns true if the user selected an adapter from the dropdown but the extension
point couldn't build a config for it

```ts
type adapterHintNotConfigurable = boolean
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                             | Signature                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`trackAdapter`](#getter-trackadapter)             | `AdapterConfig \| undefined`                                                                                                                                                                                                                                                                                        |
| [`trackName`](#getter-trackname)                   | `string`                                                                                                                                                                                                                                                                                                            |
| [`uris`](#getter-uris)                             | `(string \| undefined)[]`                                                                                                                                                                                                                                                                                           |
| [`isFtp`](#getter-isftp)                           | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`isRelativeTrackUrl`](#getter-isrelativetrackurl) | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`isRelativeIndexUrl`](#getter-isrelativeindexurl) | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`isRelativeUrl`](#getter-isrelativeurl)           | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`wrongProtocol`](#getter-wrongprotocol)           | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`unsupported`](#getter-unsupported)               | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`assembly`](#getter-assembly)                     | `any`                                                                                                                                                                                                                                                                                                               |
| [`trackAdapterType`](#getter-trackadaptertype)     | `string \| undefined`                                                                                                                                                                                                                                                                                               |
| [`trackType`](#getter-tracktype)                   | `string`                                                                                                                                                                                                                                                                                                            |
| [`warningMessage`](#getter-warningmessage)         | `"" \| "Warning: JBrowse cannot access files using the ftp protocol" \| "Warning: one or more of your files do not provide the protocol e.g.\n https://, please provide an absolute URL unless you are sure a\n relative URL is intended." \| "Warning: You entered a http:// resources but we cannot access HT...` |

</details>

<details>
<summary>AddTrackModel - Getters (all signatures)</summary>

#### getter: trackAdapter

```ts
type trackAdapter = AdapterConfig | undefined
```

#### getter: trackName

```ts
type trackName = string
```

#### getter: uris

```ts
type uris = (string | undefined)[]
```

#### getter: isFtp

```ts
type isFtp = boolean
```

#### getter: isRelativeTrackUrl

```ts
type isRelativeTrackUrl = boolean
```

#### getter: isRelativeIndexUrl

```ts
type isRelativeIndexUrl = boolean
```

#### getter: isRelativeUrl

```ts
type isRelativeUrl = boolean
```

#### getter: wrongProtocol

```ts
type wrongProtocol = boolean
```

#### getter: unsupported

```ts
type unsupported = boolean
```

#### getter: assembly

```ts
type assembly = any
```

#### getter: trackAdapterType

```ts
type trackAdapterType = string | undefined
```

#### getter: trackType

```ts
type trackType = string
```

#### getter: warningMessage

```ts
type warningMessage = "" | "Warning: JBrowse cannot access files using the ftp protocol" | "Warning: one or more of your files do not provide the protocol e.g.\n          https://, please provide an absolute URL unless you are sure a\n          relative URL is intended." | "Warning: You entered a http:// resources but we cannot access HT...
```

</details>

<details open>
<summary>AddTrackModel - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                                                   |
| ------------------------------------------ | ----------------------------------------------------------- |
| [`getTrackConfig`](#method-gettrackconfig) | `(timestamp: number) => { [x: string]: ...; } \| undefined` |

</details>

<details>
<summary>AddTrackModel - Methods (all signatures)</summary>

#### method: getTrackConfig

```ts
type getTrackConfig = (timestamp: number) => { [x: string]: ...; } | undefined
```

</details>

<details open>
<summary>AddTrackModel - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                               | Signature                                |
| ---------------------------------------------------- | ---------------------------------------- |
| [`setMixinData`](#action-setmixindata)               | `(arg: Record<string, unknown>) => void` |
| [`setAdapterHint`](#action-setadapterhint)           | `(obj: string) => void`                  |
| [`setTextIndexingConf`](#action-settextindexingconf) | `(conf: IndexingAttr) => void`           |
| [`setTextIndexTrack`](#action-settextindextrack)     | `(flag: boolean) => void`                |
| [`setTrackData`](#action-settrackdata)               | `(obj: FileLocation) => void`            |
| [`setIndexTrackData`](#action-setindextrackdata)     | `(obj: FileLocation) => void`            |
| [`setAssembly`](#action-setassembly)                 | `(str: string) => void`                  |
| [`setTrackName`](#action-settrackname)               | `(str: string) => void`                  |
| [`setTrackType`](#action-settracktype)               | `(str: string) => void`                  |
| [`clearData`](#action-cleardata)                     | `() => void`                             |

</details>

<details>
<summary>AddTrackModel - Actions (all signatures)</summary>

#### action: setMixinData

```ts
type setMixinData = (arg: Record<string, unknown>) => void
```

#### action: setAdapterHint

```ts
type setAdapterHint = (obj: string) => void
```

#### action: setTextIndexingConf

```ts
type setTextIndexingConf = (conf: IndexingAttr) => void
```

#### action: setTextIndexTrack

```ts
type setTextIndexTrack = (flag: boolean) => void
```

#### action: setTrackData

```ts
type setTrackData = (obj: FileLocation) => void
```

#### action: setIndexTrackData

```ts
type setIndexTrackData = (obj: FileLocation) => void
```

#### action: setAssembly

```ts
type setAssembly = (str: string) => void
```

#### action: setTrackName

```ts
type setTrackName = (str: string) => void
```

#### action: setTrackType

```ts
type setTrackType = (str: string) => void
```

#### action: clearData

```ts
type clearData = () => void
```

</details>
