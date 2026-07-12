---
id: jbrowsedesktopconfigmodel
title: JBrowseDesktopConfigModel
sidebar_label: Root -> JBrowseDesktopConfigModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/jbrowseModel.ts).

## Overview

the rootModel.jbrowse state model for JBrowseDesktop

## Members

| Member                                                         | Kind    | Defined by                                    | Description                                                                                             |
| -------------------------------------------------------------- | ------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [assemblyNames](#getter-assemblynames)                         | Getters | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                                                                                         |
| [rpcManager](#getter-rpcmanager)                               | Getters | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                                                                                         |
| [addAssemblyConf](#action-addassemblyconf)                     | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                                                                                         |
| [removeAssemblyConf](#action-removeassemblyconf)               | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                                                                                         |
| [addTrackConf](#action-addtrackconf)                           | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                                                                                         |
| [addConnectionConf](#action-addconnectionconf)                 | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                                                                                         |
| [deleteConnectionConf](#action-deleteconnectionconf)           | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                                                                                         |
| [deleteTrackConf](#action-deletetrackconf)                     | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                                                                                         |
| [updateTrackConf](#action-updatetrackconf)                     | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) | Updates an existing track configuration. Used to sync editable configs back to the frozen tracks array. |
| [addPlugin](#action-addplugin)                                 | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                                                                                         |
| [removePlugin](#action-removeplugin)                           | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                                                                                         |
| [setDefaultSessionConf](#action-setdefaultsessionconf)         | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                                                                                         |
| [addInternetAccountConf](#action-addinternetaccountconf)       | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                                                                                         |
| [deleteInternetAccountConf](#action-deleteinternetaccountconf) | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                                                                                         |

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from AppCoreJBrowseModel</summary>

[AppCoreJBrowseModel →](../appcorejbrowsemodel)

**Getters**

#### getter: assemblyNames

```ts
type assemblyNames = string[]
```

#### getter: rpcManager

```ts
type rpcManager = RpcManager
```

**Actions**

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

#### action: updateTrackConf

Updates an existing track configuration. Used to sync editable configs back to
the frozen tracks array.

```ts
type updateTrackConf = (trackConf: {
  [key: string]: unknown
  trackId: string
}) => void
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
