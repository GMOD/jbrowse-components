---
id: baseconnectionmodel
title: BaseConnectionModel
sidebar_label: Connection -> BaseConnectionModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseConnectionModelFactory.ts).

## Overview

## Members

| Member                                   | Kind       | Defined by          | Description                                                                                                                                                                                                                             |
| ---------------------------------------- | ---------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [tracks](#property-tracks)               | Properties | BaseConnectionModel |                                                                                                                                                                                                                                         |
| [configuration](#property-configuration) | Properties | BaseConnectionModel |                                                                                                                                                                                                                                         |
| [silent](#property-silent)               | Properties | BaseConnectionModel | set when the connection is being re-established on session load (its open tracks are already restored from `connectionTrackConfigs`), so `doConnect` suppresses first-connect side effects like launching a view or a success snackbar. |
| [loading](#volatile-loading)             | Volatiles  | BaseConnectionModel | true while `connect()` is fetching this connection's tracks; drives a loading affordance in the track selector.                                                                                                                         |
| [connectionId](#getter-connectionid)     | Getters    | BaseConnectionModel | the connection's unique id, resolved from its configuration (the config is the source of truth; connection names are not guaranteed unique)                                                                                             |
| [name](#getter-name)                     | Getters    | BaseConnectionModel |                                                                                                                                                                                                                                         |
| [connect](#action-connect)               | Actions    | BaseConnectionModel | no-op hook; concrete connections (UCSC/JB2 track hubs, etc.) override this to fetch and populate their `tracks`.                                                                                                                        |
| [setLoading](#action-setloading)         | Actions    | BaseConnectionModel |                                                                                                                                                                                                                                         |
| [addTrackConf](#action-addtrackconf)     | Actions    | BaseConnectionModel |                                                                                                                                                                                                                                         |
| [addTrackConfs](#action-addtrackconfs)   | Actions    | BaseConnectionModel |                                                                                                                                                                                                                                         |
| [setTrackConfs](#action-settrackconfs)   | Actions    | BaseConnectionModel |                                                                                                                                                                                                                                         |

<details>
<summary>BaseConnectionModel - Properties</summary>

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

</details>

<details>
<summary>BaseConnectionModel - Properties (other undocumented members)</summary>

| Member                                                 | Type                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-tracks">tracks</span>               | `IArrayType<IAnyModelType>`                           |
| <span id="property-configuration">configuration</span> | `IConfigurationReference<ConfigurationSchemaType<…>>` |

</details>

<details>
<summary>BaseConnectionModel - Volatiles</summary>

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

</details>

<details>
<summary>BaseConnectionModel - Getters</summary>

#### getter: connectionId

the connection's unique id, resolved from its configuration (the config is the
source of truth; connection names are not guaranteed unique)

```ts
type connectionId = string
```

</details>

<details>
<summary>BaseConnectionModel - Getters (other undocumented members)</summary>

| Member                             | Type     |
| ---------------------------------- | -------- |
| <span id="getter-name">name</span> | `string` |

</details>

<details>
<summary>BaseConnectionModel - Actions</summary>

#### action: connect

no-op hook; concrete connections (UCSC/JB2 track hubs, etc.) override this to
fetch and populate their `tracks`. Returns a promise so `afterAttach` can clear
the loading flag once the fetch settles.

```ts
type connect = () => Promise<void>
```

</details>

<details>
<summary>BaseConnectionModel - Actions (other undocumented members)</summary>

| Member                                               | Type                                |
| ---------------------------------------------------- | ----------------------------------- |
| <span id="action-setloading">setLoading</span>       | `(loading: boolean) => void`        |
| <span id="action-addtrackconf">addTrackConf</span>   | `(trackConf: TrackConf) => any`     |
| <span id="action-addtrackconfs">addTrackConfs</span> | `(trackConfs: TrackConf[]) => void` |
| <span id="action-settrackconfs">setTrackConfs</span> | `(trackConfs: TrackConf[]) => void` |

</details>
