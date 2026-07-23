---
id: ucsctrackhubconnection
title: UCSCTrackHubConnection
sidebar_label: Connection -> UCSCTrackHubConnection
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/UCSCTrackHubConnection/model.ts).

## Overview

## Members

| Member                                   | Kind       | Defined by                                    | Description                                                                                                                                                                                                                             |
| ---------------------------------------- | ---------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [configuration](#property-configuration) | Properties | UCSCTrackHubConnection                        |                                                                                                                                                                                                                                         |
| [type](#property-type)                   | Properties | UCSCTrackHubConnection                        |                                                                                                                                                                                                                                         |
| [connect](#action-connect)               | Actions    | UCSCTrackHubConnection                        |                                                                                                                                                                                                                                         |
| [tracks](#property-tracks)               | Properties | [BaseConnectionModel](../baseconnectionmodel) |                                                                                                                                                                                                                                         |
| [silent](#property-silent)               | Properties | [BaseConnectionModel](../baseconnectionmodel) | set when the connection is being re-established on session load (its open tracks are already restored from `connectionTrackConfigs`), so `doConnect` suppresses first-connect side effects like launching a view or a success snackbar. |
| [loading](#volatile-loading)             | Volatiles  | [BaseConnectionModel](../baseconnectionmodel) | true while `connect()` is fetching this connection's tracks; drives a loading affordance in the track selector.                                                                                                                         |
| [connectionId](#getter-connectionid)     | Getters    | [BaseConnectionModel](../baseconnectionmodel) | the connection's unique id, resolved from its configuration (the config is the source of truth; connection names are not guaranteed unique)                                                                                             |
| [name](#getter-name)                     | Getters    | [BaseConnectionModel](../baseconnectionmodel) |                                                                                                                                                                                                                                         |
| [setLoading](#action-setloading)         | Actions    | [BaseConnectionModel](../baseconnectionmodel) |                                                                                                                                                                                                                                         |
| [addTrackConf](#action-addtrackconf)     | Actions    | [BaseConnectionModel](../baseconnectionmodel) |                                                                                                                                                                                                                                         |
| [addTrackConfs](#action-addtrackconfs)   | Actions    | [BaseConnectionModel](../baseconnectionmodel) |                                                                                                                                                                                                                                         |
| [setTrackConfs](#action-settrackconfs)   | Actions    | [BaseConnectionModel](../baseconnectionmodel) |                                                                                                                                                                                                                                         |

### UCSCTrackHubConnection - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/ucsctrackhubconnection).

<details>
<summary>UCSCTrackHubConnection - Properties</summary>

| Member                                                 | Type                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-configuration">configuration</span> | `IConfigurationReference<ConfigurationSchemaType<…>>` |
| <span id="property-type">type</span>                   | `ISimpleType<"UCSCTrackHubConnection">`               |

</details>

<details>
<summary>UCSCTrackHubConnection - Actions</summary>

| Member                                   | Type                  |
| ---------------------------------------- | --------------------- |
| <span id="action-connect">connect</span> | `() => Promise<void>` |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseConnectionModel</summary>

[BaseConnectionModel →](../baseconnectionmodel)

**Properties**

#### property: silent

set when the connection is being re-established on session load (its open tracks
are already restored from `connectionTrackConfigs`), so `doConnect` suppresses
first-connect side effects like launching a view or a success snackbar.
Runtime-only: connection instances aren't serialized.

```ts
// type signature
type silent = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
silent: types.optional(types.boolean, false)
```

| Member                                   | Type                        |
| ---------------------------------------- | --------------------------- |
| <span id="property-tracks">tracks</span> | `IArrayType<IAnyModelType>` |

**Volatiles**

#### volatile: loading

true while `connect()` is fetching this connection's tracks; drives a loading
affordance in the track selector. Distinct from an empty `tracks` array, which
is also the state of a connection that loaded successfully but has no tracks.

```ts
// type signature
type loading = false
// code
loading: false
```

**Getters**

#### getter: connectionId

the connection's unique id, resolved from its configuration (the config is the
source of truth; connection names are not guaranteed unique)

```ts
type connectionId = string
```

| Member                             | Type     |
| ---------------------------------- | -------- |
| <span id="getter-name">name</span> | `string` |

**Actions**

| Member                                               | Type                                |
| ---------------------------------------------------- | ----------------------------------- |
| <span id="action-setloading">setLoading</span>       | `(loading: boolean) => void`        |
| <span id="action-addtrackconf">addTrackConf</span>   | `(trackConf: TrackConf) => any`     |
| <span id="action-addtrackconfs">addTrackConfs</span> | `(trackConfs: TrackConf[]) => void` |
| <span id="action-settrackconfs">setTrackConfs</span> | `(trackConfs: TrackConf[]) => void` |

</details>
