---
id: websessionconnectionsmixin
title: WebSessionConnectionsMixin
sidebar_label: Mixin -> WebSessionConnectionsMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/web-core/src/SessionConnections.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/WebSessionConnectionsMixin.md)

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin)

**Properties:**
[connectionInstances](../connectionmanagementsessionmixin#property-connectioninstances)

**Getters:**
[connections](../connectionmanagementsessionmixin#getter-connections)

**Actions:**
[makeConnection](../connectionmanagementsessionmixin#action-makeconnection),
[prepareToBreakConnection](../connectionmanagementsessionmixin#action-preparetobreakconnection),
[breakConnection](../connectionmanagementsessionmixin#action-breakconnection),
[deleteConnection](../connectionmanagementsessionmixin#action-deleteconnection),
[addConnectionConf](../connectionmanagementsessionmixin#action-addconnectionconf),
[clearConnections](../connectionmanagementsessionmixin#action-clearconnections)

<details open>
<summary>WebSessionConnectionsMixin - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                               | Signature                                                |
| ---------------------------------------------------- | -------------------------------------------------------- |
| [`sessionConnections`](#property-sessionconnections) | `IOptionalIType<IArrayType<IAnyModelType>, [undefined]>` |

</details>

<details>
<summary>WebSessionConnectionsMixin - Properties (all signatures)</summary>

#### property: sessionConnections

```ts
// type signature
type sessionConnections = IOptionalIType<IArrayType<IAnyModelType>, [undefined]>
// code
sessionConnections: types.stripDefault(
  types.array(pluginManager.pluggableConfigSchemaType('connection')),
  [],
)
```

</details>

<details open>
<summary>WebSessionConnectionsMixin - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                           | Signature                                                                                                                                                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`addConnectionConf`](#action-addconnectionconf) | `(connectionConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any` |
| [`deleteConnection`](#action-deleteconnection)   | `(configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any`  |

</details>

<details>
<summary>WebSessionConnectionsMixin - Actions (all signatures)</summary>

#### action: addConnectionConf

```ts
type addConnectionConf = (connectionConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

#### action: deleteConnection

```ts
type deleteConnection = (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

</details>
