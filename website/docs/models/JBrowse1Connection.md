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

| Member                                   | Kind       | Description |
| ---------------------------------------- | ---------- | ----------- |
| [configuration](#property-configuration) | Properties |             |
| [type](#property-type)                   | Properties |             |
| [connect](#action-connect)               | Actions    |             |

### JBrowse1Connection - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/jbrowse1connection).

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
<summary>JBrowse1Connection - Properties</summary>

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
