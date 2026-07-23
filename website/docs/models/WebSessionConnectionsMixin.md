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

## Members

| Member                                                             | Kind       | Defined by                                                              | Description                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [sessionConnections](#property-sessionconnections)                 | Properties | WebSessionConnectionsMixin                                              |                                                                                                                                                                                                                                                                                                                    |
| [addConnectionConf](#action-addconnectionconf)                     | Actions    | WebSessionConnectionsMixin                                              |                                                                                                                                                                                                                                                                                                                    |
| [deleteConnection](#action-deleteconnection)                       | Actions    | WebSessionConnectionsMixin                                              |                                                                                                                                                                                                                                                                                                                    |
| [connectionInstances](#property-connectioninstances)               | Properties | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                    |
| [connectionTrackConfigs](#property-connectiontrackconfigs)         | Properties | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Persisted configs of connection tracks the user has opened, keyed by trackId.                                                                                                                                                                                                                                      |
| [connections](#getter-connections)                                 | Getters    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                    |
| [makeConnection](#action-makeconnection)                           | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                    |
| [breakConnection](#action-breakconnection)                         | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Remove a live connection instance.                                                                                                                                                                                                                                                                                 |
| [teardownConnection](#action-teardownconnection)                   | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Close every track a connection contributed — the live instance's tracks plus any persisted open-track configs (a dormant connection, never expanded this session, still renders its opened tracks from `connectionTrackConfigs`) — from all views/widgets, drop the live instance, and drop the persisted configs. |
| [clearConnections](#action-clearconnections)                       | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) |                                                                                                                                                                                                                                                                                                                    |
| [captureConnectionTrack](#action-captureconnectiontrack)           | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Snapshot a just-opened connection track's config into `connectionTrackConfigs` so it survives session reload.                                                                                                                                                                                                      |
| [updateConnectionTrackConfig](#action-updateconnectiontrackconfig) | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Persist an edit to an opened connection track.                                                                                                                                                                                                                                                                     |
| [setConnectionTrackConfig](#action-setconnectiontrackconfig)       | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Upsert one opened connection track's persisted config.                                                                                                                                                                                                                                                             |
| [pruneConnectionTrackConfig](#action-pruneconnectiontrackconfig)   | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Drop a connection track's persisted config once no open view still references it, so the session doesn't accumulate closed tracks.                                                                                                                                                                                 |
| [hydrateConnection](#action-hydrateconnection)                     | Actions    | [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin) | Lazily establish a single connection by id if it isn't already live — used when its category is expanded in the track selector.                                                                                                                                                                                    |

<details>
<summary>WebSessionConnectionsMixin - Properties</summary>

| Member                                                           | Type                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| <span id="property-sessionconnections">sessionConnections</span> | `IOptionalIType<IArrayType<IAnyModelType>, [undefined]>` |

</details>

<details>
<summary>WebSessionConnectionsMixin - Actions</summary>

| Member                                                       | Type                                                                                                                                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-addconnectionconf">addConnectionConf</span> | `(connectionConf: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<…>) => any`  |
| <span id="action-deleteconnection">deleteConnection</span>   | `(configuration: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any` |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from ConnectionManagementSessionMixin</summary>

[ConnectionManagementSessionMixin →](../connectionmanagementsessionmixin)

**Properties**

#### property: connectionTrackConfigs

Persisted configs of connection tracks the user has opened, keyed by trackId.
Unlike `connectionInstances` (stripped from snapshots, holds the whole fetched
hub), this holds only the tracks in use, so an open connection track resolves
synchronously on session load without re-establishing the connection.

```ts
// type signature
type connectionTrackConfigs = IOptionalIType<IType<Record<string, ConnectionTrackConfigEntry>, Record<string, ConnectionTrackConfigEntry>, Record<...>>, [...]>
// code
connectionTrackConfigs: types.stripDefault(
        types.frozen<Record<string, ConnectionTrackConfigEntry>>(),
        {},
      )
```

| Member                                                             | Type                                                |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| <span id="property-connectioninstances">connectionInstances</span> | `IOptionalIType<IArrayType<IAnyType>, [undefined]>` |

**Getters**

| Member                                           | Type                                                                                                                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="getter-connections">connections</span> | `(ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]` |

**Actions**

#### action: breakConnection

Remove a live connection instance. Tolerant of an already-dormant connection
(its instance is stripped from the session on reload). Leaves persisted
open-track configs alone — the connect() error path calls this and the user's
already-open tracks must survive a transient failure. Full removal goes through
`deleteConnection`.

```ts
type breakConnection = (configuration: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<…>) => void
```

#### action: teardownConnection

Close every track a connection contributed — the live instance's tracks plus any
persisted open-track configs (a dormant connection, never expanded this session,
still renders its opened tracks from `connectionTrackConfigs`) — from all
views/widgets, drop the live instance, and drop the persisted configs. The
session is left as if the connection had never loaded.

```ts
type teardownConnection = (configuration: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<…>) => void
```

#### action: captureConnectionTrack

Snapshot a just-opened connection track's config into `connectionTrackConfigs`
so it survives session reload. No-op if the track isn't connection-provided or
is already captured (edits go through `updateConnectionTrackConfig`).

```ts
type captureConnectionTrack = (trackId: string) => void
```

#### action: updateConnectionTrackConfig

Persist an edit to an opened connection track. The full config is stored (not a
delta): the connection's fetched "base" isn't present at load, so only a
complete config resolves synchronously.

```ts
type updateConnectionTrackConfig = (
  trackConf: Record<string, unknown> & { trackId: string },
) => void
```

#### action: setConnectionTrackConfig

Upsert one opened connection track's persisted config.

```ts
type setConnectionTrackConfig = (
  trackId: string,
  connectionId: string,
  config: Record<string, unknown>,
) => void
```

#### action: pruneConnectionTrackConfig

Drop a connection track's persisted config once no open view still references
it, so the session doesn't accumulate closed tracks.

```ts
type pruneConnectionTrackConfig = (trackId: string) => void
```

#### action: hydrateConnection

Lazily establish a single connection by id if it isn't already live — used when
its category is expanded in the track selector. Fetches silently (no view launch
/ success snackbar); already-open tracks keep rendering from
`connectionTrackConfigs` meanwhile. Idempotent.

```ts
type hydrateConnection = (connectionId: string) => void
```

| Member                                                     | Type                                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| <span id="action-makeconnection">makeConnection</span>     | `(configuration: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>, initialSnapshot?: any) => any` |
| <span id="action-clearconnections">clearConnections</span> | `() => void`                                                                                         |

</details>
