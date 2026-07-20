---
id: jbrowse1connection
title: JBrowse1Connection
sidebar_label: Connection -> JBrowse1Connection
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`legacy-jbrowse` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1Connection/model.ts).

## Overview

Connection that imports tracks from a legacy JBrowse 1 data directory, composed
on the base connection model.

## Members

| Member                                   | Kind       | Defined by                                    | Description                                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | ---------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [configuration](#property-configuration) | Properties | JBrowse1Connection                            |                                                                                                                                                                                                                                                                                               |
| [type](#property-type)                   | Properties | JBrowse1Connection                            |                                                                                                                                                                                                                                                                                               |
| [connect](#action-connect)               | Actions    | JBrowse1Connection                            |                                                                                                                                                                                                                                                                                               |
| [tracks](#property-tracks)               | Properties | [BaseConnectionModel](../baseconnectionmodel) |                                                                                                                                                                                                                                                                                               |
| [silent](#property-silent)               | Properties | [BaseConnectionModel](../baseconnectionmodel) | set when the connection is being re-established on session load (its open tracks are already restored from `connectionTrackConfigs`), so `doConnect` suppresses first-connect side effects like launching a view or a success snackbar. Runtime-only: connection instances aren't serialized. |
| [loading](#volatile-loading)             | Volatiles  | [BaseConnectionModel](../baseconnectionmodel) | true while `connect()` is fetching this connection's tracks; drives a loading affordance in the track selector. Distinct from an empty `tracks` array, which is also the state of a connection that loaded successfully but has no tracks.                                                    |
| [connectionId](#getter-connectionid)     | Getters    | [BaseConnectionModel](../baseconnectionmodel) | the connection's unique id, resolved from its configuration (the config is the source of truth; connection names are not guaranteed unique)                                                                                                                                                   |
| [name](#getter-name)                     | Getters    | [BaseConnectionModel](../baseconnectionmodel) |                                                                                                                                                                                                                                                                                               |
| [setLoading](#action-setloading)         | Actions    | [BaseConnectionModel](../baseconnectionmodel) |                                                                                                                                                                                                                                                                                               |
| [addTrackConf](#action-addtrackconf)     | Actions    | [BaseConnectionModel](../baseconnectionmodel) |                                                                                                                                                                                                                                                                                               |
| [addTrackConfs](#action-addtrackconfs)   | Actions    | [BaseConnectionModel](../baseconnectionmodel) |                                                                                                                                                                                                                                                                                               |
| [setTrackConfs](#action-settrackconfs)   | Actions    | [BaseConnectionModel](../baseconnectionmodel) |                                                                                                                                                                                                                                                                                               |

### JBrowse1Connection - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/jbrowse1connection).

<details>
<summary>JBrowse1Connection - Properties</summary>

#### property: configuration

```ts
// type signature
type configuration = IConfigurationReference<ConfigurationSchemaType<{ readonly dataDirLocation: { readonly type: "fileLocation"; readonly defaultValue: { readonly uri: "https://mysite.com/jbrowse/data/"; readonly locationType: "UriLocation"; }; readonly description: "the location of the JBrowse 1 data directory, often something like ht...
// code
configuration: ConfigurationReference(configSchema)
```

#### property: type

```ts
// type signature
type type = ISimpleType<'JBrowse1Connection'>
// code
type: types.literal('JBrowse1Connection')
```

</details>

<details>
<summary>JBrowse1Connection - Actions</summary>

#### action: connect

```ts
type connect = () => Promise<void>
```

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseConnectionModel</summary>

[BaseConnectionModel →](../baseconnectionmodel)

**Properties**

#### property: tracks

```ts
// type signature
type tracks = IArrayType<IAnyModelType>
// code
tracks: types.array(pluginManager.pluggableConfigSchemaType('track'))
```

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

#### getter: name

```ts
type name = string
```

**Actions**

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
