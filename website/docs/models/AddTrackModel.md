---
id: addtrackmodel
title: AddTrackModel
sidebar_label: Widget -> AddTrackModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/AddTrackWidget/model.ts).

## Overview

## Members

| Member                                                           | Kind       | Defined by    | Description                                                                                                           |
| ---------------------------------------------------------------- | ---------- | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                               | Properties | AddTrackModel |                                                                                                                       |
| [type](#property-type)                                           | Properties | AddTrackModel |                                                                                                                       |
| [view](#property-view)                                           | Properties | AddTrackModel |                                                                                                                       |
| [trackAdapter](#getter-trackadapter)                             | Getters    | AddTrackModel |                                                                                                                       |
| [trackName](#getter-trackname)                                   | Getters    | AddTrackModel |                                                                                                                       |
| [uris](#getter-uris)                                             | Getters    | AddTrackModel |                                                                                                                       |
| [isFtp](#getter-isftp)                                           | Getters    | AddTrackModel |                                                                                                                       |
| [isRelativeUrl](#getter-isrelativeurl)                           | Getters    | AddTrackModel |                                                                                                                       |
| [wrongProtocol](#getter-wrongprotocol)                           | Getters    | AddTrackModel |                                                                                                                       |
| [adapterHintNotConfigurable](#getter-adapterhintnotconfigurable) | Getters    | AddTrackModel | Returns true if the user selected an adapter from the dropdown but the extension point couldn't build a config for it |
| [assembly](#getter-assembly)                                     | Getters    | AddTrackModel |                                                                                                                       |
| [trackAdapterType](#getter-trackadaptertype)                     | Getters    | AddTrackModel |                                                                                                                       |
| [trackType](#getter-tracktype)                                   | Getters    | AddTrackModel |                                                                                                                       |
| [warningMessage](#getter-warningmessage)                         | Getters    | AddTrackModel |                                                                                                                       |
| [getTrackConfig](#method-gettrackconfig)                         | Methods    | AddTrackModel |                                                                                                                       |
| [setMixinData](#action-setmixindata)                             | Actions    | AddTrackModel |                                                                                                                       |
| [setAdapterHint](#action-setadapterhint)                         | Actions    | AddTrackModel |                                                                                                                       |
| [setTextIndexingConf](#action-settextindexingconf)               | Actions    | AddTrackModel |                                                                                                                       |
| [setTextIndexTrack](#action-settextindextrack)                   | Actions    | AddTrackModel |                                                                                                                       |
| [setTrackData](#action-settrackdata)                             | Actions    | AddTrackModel |                                                                                                                       |
| [setIndexTrackData](#action-setindextrackdata)                   | Actions    | AddTrackModel |                                                                                                                       |
| [setAssembly](#action-setassembly)                               | Actions    | AddTrackModel |                                                                                                                       |
| [setTrackName](#action-settrackname)                             | Actions    | AddTrackModel |                                                                                                                       |
| [setTrackType](#action-settracktype)                             | Actions    | AddTrackModel |                                                                                                                       |
| [clearData](#action-cleardata)                                   | Actions    | AddTrackModel |                                                                                                                       |

<details>
<summary>AddTrackModel - Properties</summary>

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

<details>
<summary>AddTrackModel - Getters</summary>

#### getter: adapterHintNotConfigurable

Returns true if the user selected an adapter from the dropdown but the extension
point couldn't build a config for it

```ts
type adapterHintNotConfigurable = boolean
```

</details>

<details>
<summary>AddTrackModel - Getters (other undocumented members)</summary>

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

#### getter: isRelativeUrl

```ts
type isRelativeUrl = boolean
```

#### getter: wrongProtocol

```ts
type wrongProtocol = boolean
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

<details>
<summary>AddTrackModel - Methods</summary>

#### method: getTrackConfig

```ts
type getTrackConfig = (timestamp: number) => { [x: string]: ...; } | undefined
```

</details>

<details>
<summary>AddTrackModel - Actions</summary>

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
