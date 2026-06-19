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

<details>
<summary>WebSessionConnectionsMixin - Properties</summary>

#### property: sessionConnections

```js
// type signature
IOptionalIType<IArrayType<IAnyModelType>, [undefined]>
// code
sessionConnections: types.stripDefault(
          types.array(pluginManager.pluggableConfigSchemaType('connection')),
          [],
        )
```

</details>

<details>
<summary>WebSessionConnectionsMixin - Actions</summary>

#### action: addConnectionConf

```js
// type signature
addConnectionConf: (connectionConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

#### action: deleteConnection

```js
// type signature
deleteConnection: (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

</details>
