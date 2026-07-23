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

| Member                                                         | Kind    | Defined by                                    | Description                              |
| -------------------------------------------------------------- | ------- | --------------------------------------------- | ---------------------------------------- |
| [assemblyNames](#getter-assemblynames)                         | Getters | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                          |
| [rpcManager](#getter-rpcmanager)                               | Getters | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                          |
| [addAssemblyConf](#action-addassemblyconf)                     | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                          |
| [removeAssemblyConf](#action-removeassemblyconf)               | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                          |
| [addTrackConf](#action-addtrackconf)                           | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                          |
| [addConnectionConf](#action-addconnectionconf)                 | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                          |
| [deleteConnectionConf](#action-deleteconnectionconf)           | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                          |
| [deleteTrackConf](#action-deletetrackconf)                     | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                          |
| [updateTrackConf](#action-updatetrackconf)                     | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) | Updates an existing track configuration. |
| [addPlugin](#action-addplugin)                                 | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                          |
| [removePlugin](#action-removeplugin)                           | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                          |
| [setDefaultSessionConf](#action-setdefaultsessionconf)         | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                          |
| [addInternetAccountConf](#action-addinternetaccountconf)       | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                          |
| [deleteInternetAccountConf](#action-deleteinternetaccountconf) | Actions | [AppCoreJBrowseModel](../appcorejbrowsemodel) |                                          |

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from AppCoreJBrowseModel</summary>

[AppCoreJBrowseModel →](../appcorejbrowsemodel)

**Getters**

| Member                                               | Type         |
| ---------------------------------------------------- | ------------ |
| <span id="getter-assemblynames">assemblyNames</span> | `string[]`   |
| <span id="getter-rpcmanager">rpcManager</span>       | `RpcManager` |

**Actions**

#### action: updateTrackConf

Updates an existing track configuration. Used to sync editable configs back to
the frozen tracks array.

```ts
type updateTrackConf = (trackConf: {
  [key: string]: unknown
  trackId: string
}) => void
```

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
