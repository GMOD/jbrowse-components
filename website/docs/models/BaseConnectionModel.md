---
id: baseconnectionmodel
title: BaseConnectionModel
sidebar_label: Connection -> BaseConnectionModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseConnectionModelFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseConnectionModel.md)

## Overview

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">BaseConnectionModel - Properties</summary>

#### property: tracks

```js
// type signature
IArrayType<IAnyModelType>
// code
tracks: types.array(pluginManager.pluggableConfigSchemaType('track'))
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">BaseConnectionModel - Getters</summary>

#### getter: connectionId

the connection's unique id, resolved from its configuration (the config is the
source of truth; connection names are not guaranteed unique)

```js
// type
string
```

#### getter: name

```js
// type
string
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">BaseConnectionModel - Actions</summary>

#### action: connect

```js
// type signature
connect: (_arg: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => void
```

#### action: addTrackConf

```js
// type signature
addTrackConf: (trackConf: TrackConf) => any
```

#### action: addTrackConfs

```js
// type signature
addTrackConfs: (trackConfs: TrackConf[]) => void
```

#### action: setTrackConfs

```js
// type signature
setTrackConfs: (trackConfs: TrackConf[]) => void
```

#### action: clear

```js
// type signature
clear: () => void
```

</details>
