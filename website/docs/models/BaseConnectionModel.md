---
id: baseconnectionmodel
title: BaseConnectionModel
sidebar_label: Connection -> BaseConnectionModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseConnectionModelFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseConnectionModel.md)

## Overview

<details open>
<summary>BaseConnectionModel - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                   |
| ------------------------------------------ | --------------------------- |
| [`tracks`](#property-tracks)               | `IArrayType<IAnyModelType>` |
| [`configuration`](#property-configuration) | `ITypeUnion<any, any, any>` |

</details>

<details>
<summary>BaseConnectionModel - Properties (all signatures)</summary>

#### property: tracks

```ts
// type signature
type tracks = IArrayType<IAnyModelType>
// code
tracks: types.array(pluginManager.pluggableConfigSchemaType('track'))
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details open>
<summary>BaseConnectionModel - Getters</summary>

#### getter: connectionId

the connection's unique id, resolved from its configuration (the config is the
source of truth; connection names are not guaranteed unique)

```ts
type connectionId = string
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                 | Signature |
| ---------------------- | --------- |
| [`name`](#getter-name) | `string`  |

</details>

<details>
<summary>BaseConnectionModel - Getters (all signatures)</summary>

#### getter: name

```ts
type name = string
```

</details>

<details open>
<summary>BaseConnectionModel - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                   | Signature                                                                                                                                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`connect`](#action-connect)             | `(_arg: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => void` |
| [`addTrackConf`](#action-addtrackconf)   | `(trackConf: TrackConf) => any`                                                                                                                                                                                |
| [`addTrackConfs`](#action-addtrackconfs) | `(trackConfs: TrackConf[]) => void`                                                                                                                                                                            |
| [`setTrackConfs`](#action-settrackconfs) | `(trackConfs: TrackConf[]) => void`                                                                                                                                                                            |
| [`clear`](#action-clear)                 | `() => void`                                                                                                                                                                                                   |

</details>

<details>
<summary>BaseConnectionModel - Actions (all signatures)</summary>

#### action: connect

```ts
type connect = (_arg: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => void
```

#### action: addTrackConf

```ts
type addTrackConf = (trackConf: TrackConf) => any
```

#### action: addTrackConfs

```ts
type addTrackConfs = (trackConfs: TrackConf[]) => void
```

#### action: setTrackConfs

```ts
type setTrackConfs = (trackConfs: TrackConf[]) => void
```

#### action: clear

```ts
type clear = () => void
```

</details>
