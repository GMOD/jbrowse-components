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

<details open>
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

#### property: tracks

```ts
// type signature
type tracks = IArrayType<IAnyModelType>
// code
tracks: types.array(pluginManager.pluggableConfigSchemaType('track'))
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details open>
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

<details open>
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

#### getter: name

```ts
type name = string
```

</details>

<details open>
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

#### action: setLoading

```ts
type setLoading = (loading: boolean) => void
```

#### action: addTrackConf

```ts
type addTrackConf = (trackConf: TrackConf) => any
```

#### action: addTrackConfs

```ts
type addTrackConfs = (trackConfs: TrackConf[]) => void
```

#### action: setTrackConfs

```ts
type setTrackConfs = (trackConfs: TrackConf[]) => void
```

</details>
