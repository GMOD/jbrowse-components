---
id: appcorejbrowsemodel
title: AppCoreJBrowseModel
sidebar_label: Root -> AppCoreJBrowseModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/JBrowseModel/index.ts).

## Overview

built on the [JBrowseRootConfig](/docs/config/jbrowserootconfig) config model —
config models are MST trees themselves, which is why this state model is allowed
to build on one. Generally found on a property named rootModel.jbrowse

## Members

| Member                                                         | Kind    | Defined by          | Description                                                                                             |
| -------------------------------------------------------------- | ------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| [assemblyNames](#getter-assemblynames)                         | Getters | AppCoreJBrowseModel |                                                                                                         |
| [rpcManager](#getter-rpcmanager)                               | Getters | AppCoreJBrowseModel |                                                                                                         |
| [addAssemblyConf](#action-addassemblyconf)                     | Actions | AppCoreJBrowseModel |                                                                                                         |
| [removeAssemblyConf](#action-removeassemblyconf)               | Actions | AppCoreJBrowseModel |                                                                                                         |
| [addTrackConf](#action-addtrackconf)                           | Actions | AppCoreJBrowseModel |                                                                                                         |
| [addConnectionConf](#action-addconnectionconf)                 | Actions | AppCoreJBrowseModel |                                                                                                         |
| [deleteConnectionConf](#action-deleteconnectionconf)           | Actions | AppCoreJBrowseModel |                                                                                                         |
| [deleteTrackConf](#action-deletetrackconf)                     | Actions | AppCoreJBrowseModel |                                                                                                         |
| [updateTrackConf](#action-updatetrackconf)                     | Actions | AppCoreJBrowseModel | Updates an existing track configuration. Used to sync editable configs back to the frozen tracks array. |
| [addPlugin](#action-addplugin)                                 | Actions | AppCoreJBrowseModel |                                                                                                         |
| [removePlugin](#action-removeplugin)                           | Actions | AppCoreJBrowseModel |                                                                                                         |
| [setDefaultSessionConf](#action-setdefaultsessionconf)         | Actions | AppCoreJBrowseModel |                                                                                                         |
| [addInternetAccountConf](#action-addinternetaccountconf)       | Actions | AppCoreJBrowseModel |                                                                                                         |
| [deleteInternetAccountConf](#action-deleteinternetaccountconf) | Actions | AppCoreJBrowseModel |                                                                                                         |

<details>
<summary>AppCoreJBrowseModel - Getters</summary>

#### getter: assemblyNames

```ts
type assemblyNames = string[]
```

#### getter: rpcManager

```ts
type rpcManager = RpcManager
```

</details>

<details>
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

</details>

<details>
<summary>AppCoreJBrowseModel - Actions (other undocumented members)</summary>

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
