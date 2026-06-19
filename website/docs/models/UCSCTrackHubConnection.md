---
id: ucsctrackhubconnection
title: UCSCTrackHubConnection
sidebar_label: Connection -> UCSCTrackHubConnection
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/UCSCTrackHubConnection/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/UCSCTrackHubConnection.md)

## Overview

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

<details>
<summary>UCSCTrackHubConnection - Properties</summary>

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: type

```js
// type signature
ISimpleType<"UCSCTrackHubConnection">
// code
type: types.literal('UCSCTrackHubConnection')
```

</details>

<details>
<summary>UCSCTrackHubConnection - Actions</summary>

#### action: connect

```js
// type signature
connect: () => Promise<void>
```

</details>
