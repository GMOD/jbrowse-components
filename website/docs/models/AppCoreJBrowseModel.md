---
id: appcorejbrowsemodel
title: AppCoreJBrowseModel
sidebar_label: Root -> AppCoreJBrowseModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/JBrowseModel/index.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/AppCoreJBrowseModel.md)

## Overview

built on the [JBrowseRootConfig](/docs/config/jbrowserootconfig) config model —
config models are MST trees themselves, which is why this state model is allowed
to build on one. Generally found on a property named rootModel.jbrowse

<details open>
<summary>AppCoreJBrowseModel - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                   | Signature    |
| ---------------------------------------- | ------------ |
| [`assemblyNames`](#getter-assemblynames) | `string[]`   |
| [`rpcManager`](#getter-rpcmanager)       | `RpcManager` |

</details>

<details>
<summary>AppCoreJBrowseModel - Getters (all signatures)</summary>

#### getter: assemblyNames

```ts
type assemblyNames = string[]
```

#### getter: rpcManager

```ts
type rpcManager = RpcManager
```

</details>

<details open>
<summary>AppCoreJBrowseModel - Actions</summary>

#### action: updateTrackConf

Updates an existing track configuration. Used to sync editable configs back to
the frozen tracks array.

```ts
type updateTrackConf = (trackConf: {
  [key: string]: unknown
  trackId: string
}) => void
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                           | Signature                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`addAssemblyConf`](#action-addassemblyconf)                     | `(conf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => ModelInstanceTypeProps<...> & ... 1 more ... & IStateTreeNode<...>` |
| [`removeAssemblyConf`](#action-removeassemblyconf)               | `(assemblyName: string) => void`                                                                                                                                                                                                                                             |
| [`addTrackConf`](#action-addtrackconf)                           | `(trackConf: { trackId: string; type: string; }) => { [key: string]: unknown; trackId: string; } \| undefined`                                                                                                                                                               |
| [`addConnectionConf`](#action-addconnectionconf)                 | `(connectionConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any`                                                      |
| [`deleteConnectionConf`](#action-deleteconnectionconf)           | `(configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => boolean`                                                   |
| [`deleteTrackConf`](#action-deletetrackconf)                     | `(trackConf: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) \| { ...; }) => void`                                            |
| [`addPlugin`](#action-addplugin)                                 | `(pluginDefinition: PluginDefinition) => void`                                                                                                                                                                                                                               |
| [`removePlugin`](#action-removeplugin)                           | `(pluginDefinition: PluginDefinition) => void`                                                                                                                                                                                                                               |
| [`setDefaultSessionConf`](#action-setdefaultsessionconf)         | `(sessionConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => void`                                                        |
| [`addInternetAccountConf`](#action-addinternetaccountconf)       | `(internetAccountConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any`                                                 |
| [`deleteInternetAccountConf`](#action-deleteinternetaccountconf) | `(configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => boolean`                                                   |

</details>

<details>
<summary>AppCoreJBrowseModel - Actions (all signatures)</summary>

#### action: addAssemblyConf

```ts
type addAssemblyConf = (conf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => ModelInstanceTypeProps<...> & ... 1 more ... & IStateTreeNode<...>
```

#### action: removeAssemblyConf

```ts
type removeAssemblyConf = (assemblyName: string) => void
```

#### action: addTrackConf

```ts
type addTrackConf = (trackConf: {
  trackId: string
  type: string
}) => { [key: string]: unknown; trackId: string } | undefined
```

#### action: addConnectionConf

```ts
type addConnectionConf = (connectionConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

#### action: deleteConnectionConf

```ts
type deleteConnectionConf = (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => boolean
```

#### action: deleteTrackConf

```ts
type deleteTrackConf = (trackConf: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) | { ...; }) => void
```

#### action: addPlugin

```ts
type addPlugin = (pluginDefinition: PluginDefinition) => void
```

#### action: removePlugin

```ts
type removePlugin = (pluginDefinition: PluginDefinition) => void
```

#### action: setDefaultSessionConf

```ts
type setDefaultSessionConf = (sessionConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => void
```

#### action: addInternetAccountConf

```ts
type addInternetAccountConf = (internetAccountConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

#### action: deleteInternetAccountConf

```ts
type deleteInternetAccountConf = (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => boolean
```

</details>
