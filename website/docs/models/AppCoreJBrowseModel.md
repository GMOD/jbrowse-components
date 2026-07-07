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

| Member                                                         | Kind    | Description                                                                                             |
| -------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| [assemblyNames](#getter-assemblynames)                         | Getters |                                                                                                         |
| [rpcManager](#getter-rpcmanager)                               | Getters |                                                                                                         |
| [addAssemblyConf](#action-addassemblyconf)                     | Actions |                                                                                                         |
| [removeAssemblyConf](#action-removeassemblyconf)               | Actions |                                                                                                         |
| [addTrackConf](#action-addtrackconf)                           | Actions |                                                                                                         |
| [addConnectionConf](#action-addconnectionconf)                 | Actions |                                                                                                         |
| [deleteConnectionConf](#action-deleteconnectionconf)           | Actions |                                                                                                         |
| [deleteTrackConf](#action-deletetrackconf)                     | Actions |                                                                                                         |
| [updateTrackConf](#action-updatetrackconf)                     | Actions | Updates an existing track configuration. Used to sync editable configs back to the frozen tracks array. |
| [addPlugin](#action-addplugin)                                 | Actions |                                                                                                         |
| [removePlugin](#action-removeplugin)                           | Actions |                                                                                                         |
| [setDefaultSessionConf](#action-setdefaultsessionconf)         | Actions |                                                                                                         |
| [addInternetAccountConf](#action-addinternetaccountconf)       | Actions |                                                                                                         |
| [deleteInternetAccountConf](#action-deleteinternetaccountconf) | Actions |                                                                                                         |

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
