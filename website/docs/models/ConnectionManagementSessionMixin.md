---
id: connectionmanagementsessionmixin
title: ConnectionManagementSessionMixin
sidebar_label: Mixin -> ConnectionManagementSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Connections.ts).

## Overview

## Members

| Member                                                             | Kind       | Defined by                       | Description                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | ---------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [connectionInstances](#property-connectioninstances)               | Properties | ConnectionManagementSessionMixin |                                                                                                                                                                                                                                                                                                                    |
| [connectionTrackConfigs](#property-connectiontrackconfigs)         | Properties | ConnectionManagementSessionMixin | Persisted configs of connection tracks the user has opened, keyed by trackId.                                                                                                                                                                                                                                      |
| [connections](#getter-connections)                                 | Getters    | ConnectionManagementSessionMixin |                                                                                                                                                                                                                                                                                                                    |
| [makeConnection](#action-makeconnection)                           | Actions    | ConnectionManagementSessionMixin |                                                                                                                                                                                                                                                                                                                    |
| [breakConnection](#action-breakconnection)                         | Actions    | ConnectionManagementSessionMixin | Remove a live connection instance.                                                                                                                                                                                                                                                                                 |
| [teardownConnection](#action-teardownconnection)                   | Actions    | ConnectionManagementSessionMixin | Close every track a connection contributed — the live instance's tracks plus any persisted open-track configs (a dormant connection, never expanded this session, still renders its opened tracks from `connectionTrackConfigs`) — from all views/widgets, drop the live instance, and drop the persisted configs. |
| [deleteConnection](#action-deleteconnection)                       | Actions    | ConnectionManagementSessionMixin | Fully remove a connection: tear down its tracks and live instance, then delete its config.                                                                                                                                                                                                                         |
| [addConnectionConf](#action-addconnectionconf)                     | Actions    | ConnectionManagementSessionMixin |                                                                                                                                                                                                                                                                                                                    |
| [clearConnections](#action-clearconnections)                       | Actions    | ConnectionManagementSessionMixin |                                                                                                                                                                                                                                                                                                                    |
| [captureConnectionTrack](#action-captureconnectiontrack)           | Actions    | ConnectionManagementSessionMixin | Snapshot a just-opened connection track's config into `connectionTrackConfigs` so it survives session reload.                                                                                                                                                                                                      |
| [updateConnectionTrackConfig](#action-updateconnectiontrackconfig) | Actions    | ConnectionManagementSessionMixin | Persist an edit to an opened connection track.                                                                                                                                                                                                                                                                     |
| [setConnectionTrackConfig](#action-setconnectiontrackconfig)       | Actions    | ConnectionManagementSessionMixin | Upsert one opened connection track's persisted config.                                                                                                                                                                                                                                                             |
| [pruneConnectionTrackConfig](#action-pruneconnectiontrackconfig)   | Actions    | ConnectionManagementSessionMixin | Drop a connection track's persisted config once no open view still references it, so the session doesn't accumulate closed tracks.                                                                                                                                                                                 |
| [hydrateConnection](#action-hydrateconnection)                     | Actions    | ConnectionManagementSessionMixin | Lazily establish a single connection by id if it isn't already live — used when its category is expanded in the track selector.                                                                                                                                                                                    |

<details>
<summary>ConnectionManagementSessionMixin - Properties</summary>

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

</details>

<details>
<summary>ConnectionManagementSessionMixin - Properties (other undocumented members)</summary>

| Member                                                             | Type                                                |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| <span id="property-connectioninstances">connectionInstances</span> | `IOptionalIType<IArrayType<IAnyType>, [undefined]>` |

</details>

<details>
<summary>ConnectionManagementSessionMixin - Getters</summary>

| Member                                           | Type                                                                                                                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="getter-connections">connections</span> | `(ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]` |

</details>

<details>
<summary>ConnectionManagementSessionMixin - Actions</summary>

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

#### action: deleteConnection

Fully remove a connection: tear down its tracks and live instance, then delete
its config.

```ts
type deleteConnection = (configuration: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
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

</details>

<details>
<summary>ConnectionManagementSessionMixin - Actions (other undocumented members)</summary>

| Member                                                       | Type                                                                                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-makeconnection">makeConnection</span>       | `(configuration: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>, initialSnapshot?: any) => any`                                                                                  |
| <span id="action-addconnectionconf">addConnectionConf</span> | `(connectionConf: ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<…>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<…>) => any` |
| <span id="action-clearconnections">clearConnections</span>   | `() => void`                                                                                                                                                                          |

</details>
