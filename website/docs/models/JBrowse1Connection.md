---
id: jbrowse1connection
title: JBrowse1Connection
sidebar_label: Connection -> JBrowse1Connection
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1Connection/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowse1Connection.md)

## Overview

Connection that imports tracks from a legacy JBrowse 1 data directory, composed
on the base connection model.

### JBrowse1Connection - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/jbrowse1connection).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseConnectionModel](../baseconnectionmodel)

**Properties:** [tracks](../baseconnectionmodel#property-tracks),
[configuration](../baseconnectionmodel#property-configuration)

**Getters:** [connectionId](../baseconnectionmodel#getter-connectionid),
[name](../baseconnectionmodel#getter-name)

**Actions:** [connect](../baseconnectionmodel#action-connect),
[addTrackConf](../baseconnectionmodel#action-addtrackconf),
[addTrackConfs](../baseconnectionmodel#action-addtrackconfs),
[setTrackConfs](../baseconnectionmodel#action-settrackconfs),
[clear](../baseconnectionmodel#action-clear)

<details open>
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

<details open>
<summary>JBrowse1Connection - Actions</summary>

#### action: connect

```ts
type connect = () => Promise<void>
```

</details>
