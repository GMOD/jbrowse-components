---
id: jb2trackhubconnection
title: JB2TrackHubConnection
sidebar_label: Connection -> JB2TrackHubConnection
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/JB2TrackHubConnection/model.ts).

## Overview

## Members

| Member                                   | Kind       | Description |
| ---------------------------------------- | ---------- | ----------- |
| [configuration](#property-configuration) | Properties |             |
| [type](#property-type)                   | Properties |             |
| [connect](#action-connect)               | Actions    |             |

### JB2TrackHubConnection - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/jb2trackhubconnection).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseConnectionModel](../baseconnectionmodel)

**Properties:** [tracks](../baseconnectionmodel#property-tracks),
[configuration](../baseconnectionmodel#property-configuration),
[silent](../baseconnectionmodel#property-silent)

**Volatiles:** [loading](../baseconnectionmodel#volatile-loading)

**Getters:** [connectionId](../baseconnectionmodel#getter-connectionid),
[name](../baseconnectionmodel#getter-name)

**Actions:** [connect](../baseconnectionmodel#action-connect),
[setLoading](../baseconnectionmodel#action-setloading),
[addTrackConf](../baseconnectionmodel#action-addtrackconf),
[addTrackConfs](../baseconnectionmodel#action-addtrackconfs),
[setTrackConfs](../baseconnectionmodel#action-settrackconfs)

<details>
<summary>JB2TrackHubConnection - Properties</summary>

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: type

```ts
// type signature
type type = ISimpleType<'JB2TrackHubConnection'>
// code
type: types.literal('JB2TrackHubConnection')
```

</details>

<details>
<summary>JB2TrackHubConnection - Actions</summary>

#### action: connect

```ts
type connect = () => Promise<void>
```

</details>
