---
id: jb2trackhubconnection
title: JB2TrackHubConnection
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/JB2TrackHubConnection/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JB2TrackHubConnection.md)

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseConnectionModel](../baseconnectionmodel)

**Properties:** tracks, configuration

**Getters:** connectionId, name

**Actions:** connect, addTrackConf, addTrackConfs, setTrackConfs, clear

### JB2TrackHubConnection - Properties

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
ISimpleType<"JB2TrackHubConnection">
// code
type: types.literal('JB2TrackHubConnection')
```

### JB2TrackHubConnection - Actions

#### action: connect

```js
// type signature
connect: () => Promise<void>
```
