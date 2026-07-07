---
id: websessionconnectionsmixin
title: WebSessionConnectionsMixin
sidebar_label: Mixin -> WebSessionConnectionsMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/web-core/src/SessionConnections.ts).

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin)

**Properties:**
[connectionInstances](../connectionmanagementsessionmixin#property-connectioninstances),
[connectionTrackConfigs](../connectionmanagementsessionmixin#property-connectiontrackconfigs)

**Getters:**
[connections](../connectionmanagementsessionmixin#getter-connections)

**Actions:**
[makeConnection](../connectionmanagementsessionmixin#action-makeconnection),
[breakConnection](../connectionmanagementsessionmixin#action-breakconnection),
[teardownConnection](../connectionmanagementsessionmixin#action-teardownconnection),
[deleteConnection](../connectionmanagementsessionmixin#action-deleteconnection),
[addConnectionConf](../connectionmanagementsessionmixin#action-addconnectionconf),
[clearConnections](../connectionmanagementsessionmixin#action-clearconnections),
[captureConnectionTrack](../connectionmanagementsessionmixin#action-captureconnectiontrack),
[updateConnectionTrackConfig](../connectionmanagementsessionmixin#action-updateconnectiontrackconfig),
[setConnectionTrackConfig](../connectionmanagementsessionmixin#action-setconnectiontrackconfig),
[pruneConnectionTrackConfig](../connectionmanagementsessionmixin#action-pruneconnectiontrackconfig),
[hydrateConnection](../connectionmanagementsessionmixin#action-hydrateconnection)

<details>
<summary>WebSessionConnectionsMixin - Properties</summary>

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

<details>
<summary>WebSessionConnectionsMixin - Actions</summary>

#### action: addConnectionConf

```ts
type addConnectionConf = (connectionConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

#### action: deleteConnection

```ts
type deleteConnection = (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

</details>
