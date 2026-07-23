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

| Member                               | Type                                               |
| ------------------------------------ | -------------------------------------------------- |
| <span id="property-id">id</span>     | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-type">type</span> | `ISimpleType<"AddTrackWidget">`                    |
| <span id="property-view">view</span> | `IMaybe<IReferenceType<IAnyType>>`                 |

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

| Member                                                     | Type                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| <span id="getter-trackadapter">trackAdapter</span>         | `AdapterConfig \| undefined`                                               |
| <span id="getter-trackname">trackName</span>               | `string`                                                                   |
| <span id="getter-uris">uris</span>                         | `(string \| undefined)[]`                                                  |
| <span id="getter-isftp">isFtp</span>                       | `boolean`                                                                  |
| <span id="getter-isrelativeurl">isRelativeUrl</span>       | `boolean`                                                                  |
| <span id="getter-wrongprotocol">wrongProtocol</span>       | `boolean`                                                                  |
| <span id="getter-assembly">assembly</span>                 | `any`                                                                      |
| <span id="getter-trackadaptertype">trackAdapterType</span> | `string \| undefined`                                                      |
| <span id="getter-tracktype">trackType</span>               | `string`                                                                   |
| <span id="getter-warningmessage">warningMessage</span>     | `"" \| "Warning: JBrowse cannot access files using the ftp protocol" \| …` |

</details>

<details>
<summary>AddTrackModel - Methods</summary>

| Member                                                 | Type                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| <span id="method-gettrackconfig">getTrackConfig</span> | `(timestamp: number) => { [x: string]: ...; } \| undefined` |

</details>

<details>
<summary>AddTrackModel - Actions</summary>

| Member                                                           | Type                                     |
| ---------------------------------------------------------------- | ---------------------------------------- |
| <span id="action-setmixindata">setMixinData</span>               | `(arg: Record<string, unknown>) => void` |
| <span id="action-setadapterhint">setAdapterHint</span>           | `(obj: string) => void`                  |
| <span id="action-settextindexingconf">setTextIndexingConf</span> | `(conf: IndexingAttr) => void`           |
| <span id="action-settextindextrack">setTextIndexTrack</span>     | `(flag: boolean) => void`                |
| <span id="action-settrackdata">setTrackData</span>               | `(obj: FileLocation) => void`            |
| <span id="action-setindextrackdata">setIndexTrackData</span>     | `(obj: FileLocation) => void`            |
| <span id="action-setassembly">setAssembly</span>                 | `(str: string) => void`                  |
| <span id="action-settrackname">setTrackName</span>               | `(str: string) => void`                  |
| <span id="action-settracktype">setTrackType</span>               | `(str: string) => void`                  |
| <span id="action-cleardata">clearData</span>                     | `() => void`                             |

</details>
