---
id: basetrackmodel
title: BaseTrackModel
sidebar_label: Track -> BaseTrackModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseTrackModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseTrackModel.md)

## Overview

these MST models only exist for tracks that are _shown_. they should contain
only UI state for the track, and have a reference to a track configuration. note
that multiple displayed tracks could use the same configuration.

<details open>
<summary>BaseTrackModel - Properties</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```ts
// type signature
type type = ISimpleType<string>
// code
type: types.literal(trackType)
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(baseTrackConfig)
```

#### property: minimized

```ts
// type signature
type minimized = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
minimized: types.stripDefault(types.boolean, false)
```

#### property: pinned

```ts
// type signature
type pinned = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
pinned: types.stripDefault(types.boolean, false)
```

#### property: displays

```ts
// type signature
type displays = IArrayType<IAnyType>
// code
displays: types.array(pm.pluggableMstType('display', 'stateModel'))
```

</details>

<details open>
<summary>BaseTrackModel - Getters</summary>

#### getter: trackId

```ts
type trackId = string
```

#### getter: rpcSessionId

determines which webworker to send the track to, currently based on trackId

```ts
type rpcSessionId = string
```

#### getter: name

```ts
type name = any
```

#### getter: textSearchAdapter

```ts
type textSearchAdapter = any
```

#### getter: adapterConfig

```ts
type adapterConfig = any
```

#### getter: activeDisplay

a shown track always has at least one display

```ts
type activeDisplay = any
```

#### getter: viewMenuActions

```ts
type viewMenuActions = MenuItem[]
```

#### getter: canConfigure

```ts
type canConfigure = boolean
```

#### getter: adapterType

```ts
type adapterType = AdapterType
```

</details>

<details open>
<summary>BaseTrackModel - Methods</summary>

#### method: saveTrackFileFormatOptions

```ts
type saveTrackFileFormatOptions = () => Record<string, FileTypeExporter>
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => MenuItem[]
```

</details>

<details open>
<summary>BaseTrackModel - Actions</summary>

#### action: setPinned

```ts
type setPinned = (flag: boolean) => void
```

#### action: setMinimized

```ts
type setMinimized = (flag: boolean) => void
```

#### action: replaceDisplay

```ts
type replaceDisplay = (
  oldDisplayId: string,
  newDisplayId: string,
  initialSnapshot?: any,
) => void
```

</details>
