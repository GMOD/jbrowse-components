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

| Member                                                         | Kind    | Defined by          | Description                              |
| -------------------------------------------------------------- | ------- | ------------------- | ---------------------------------------- |
| [assemblyNames](#getter-assemblynames)                         | Getters | AppCoreJBrowseModel |                                          |
| [rpcManager](#getter-rpcmanager)                               | Getters | AppCoreJBrowseModel |                                          |
| [addAssemblyConf](#action-addassemblyconf)                     | Actions | AppCoreJBrowseModel |                                          |
| [removeAssemblyConf](#action-removeassemblyconf)               | Actions | AppCoreJBrowseModel |                                          |
| [addTrackConf](#action-addtrackconf)                           | Actions | AppCoreJBrowseModel |                                          |
| [addConnectionConf](#action-addconnectionconf)                 | Actions | AppCoreJBrowseModel |                                          |
| [deleteConnectionConf](#action-deleteconnectionconf)           | Actions | AppCoreJBrowseModel |                                          |
| [deleteTrackConf](#action-deletetrackconf)                     | Actions | AppCoreJBrowseModel |                                          |
| [updateTrackConf](#action-updatetrackconf)                     | Actions | AppCoreJBrowseModel | Updates an existing track configuration. |
| [addPlugin](#action-addplugin)                                 | Actions | AppCoreJBrowseModel |                                          |
| [removePlugin](#action-removeplugin)                           | Actions | AppCoreJBrowseModel |                                          |
| [setDefaultSessionConf](#action-setdefaultsessionconf)         | Actions | AppCoreJBrowseModel |                                          |
| [addInternetAccountConf](#action-addinternetaccountconf)       | Actions | AppCoreJBrowseModel |                                          |
| [deleteInternetAccountConf](#action-deleteinternetaccountconf) | Actions | AppCoreJBrowseModel |                                          |

<details>
<summary>AppCoreJBrowseModel - Getters</summary>

| Member                                               | Type         |
| ---------------------------------------------------- | ------------ |
| <span id="getter-assemblynames">assemblyNames</span> | `string[]`   |
| <span id="getter-rpcmanager">rpcManager</span>       | `RpcManager` |

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

| Member                                                                       | Type                                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-addassemblyconf">addAssemblyConf</span>                     | `(conf: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) => ModelInstanceTypeProps<…> & ... 1 more ... & IStateTreeNode<…>`                                                       |
| <span id="action-removeassemblyconf">removeAssemblyConf</span>               | `(assemblyName: string) => void`                                                                                                                                                      |
| <span id="action-addtrackconf">addTrackConf</span>                           | `(trackConf: { trackId: string; type: string; }) => { [key: string]: unknown; trackId: string; } \| undefined`                                                                        |
| <span id="action-addconnectionconf">addConnectionConf</span>                 | `(connectionConf: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<…>) => any` |
| <span id="action-deleteconnectionconf">deleteConnectionConf</span>           | `(configuration: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) => boolean`                                                                                                     |
| <span id="action-deletetrackconf">deleteTrackConf</span>                     | `(trackConf: (ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) \| { ...; }) => void`                                                                                              |
| <span id="action-addplugin">addPlugin</span>                                 | `(pluginDefinition: PluginDefinition) => void`                                                                                                                                        |
| <span id="action-removeplugin">removePlugin</span>                           | `(pluginDefinition: PluginDefinition) => void`                                                                                                                                        |
| <span id="action-setdefaultsessionconf">setDefaultSessionConf</span>         | `(sessionConf: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => void` |
| <span id="action-addinternetaccountconf">addInternetAccountConf</span>       | `(internetAccountConf: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) => any`                                                                                                   |
| <span id="action-deleteinternetaccountconf">deleteInternetAccountConf</span> | `(configuration: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) => boolean`                                                                                                     |

</details>
