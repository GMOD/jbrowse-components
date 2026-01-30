---
id: basetrackmodel
title: BaseTrackModel
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

## Docs

these MST models only exist for tracks that are _shown_. they should contain
only UI state for the track, and have a reference to a track configuration. note
that multiple displayed tracks could use the same configuration.

### BaseTrackModel - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```js
// type signature
ISimpleType<string>
// code
type: types.literal(trackType)
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(baseTrackConfig)
```

#### property: minimized

```js
// type signature
false
// code
minimized: false
```

#### property: pinned

```js
// type signature
false
// code
pinned: false
```

#### property: displays

```js
// type signature
IArrayType<IAnyType>
// code
displays: types.array(pm.pluggableMstType('display', 'stateModel'))
```

### BaseTrackModel - Getters

#### getter: trackId

```js
// type
string
```

#### getter: rpcSessionId

determines which webworker to send the track to, currently based on trackId

```js
// type
any
```

#### getter: name

```js
// type
any
```

#### getter: textSearchAdapter

```js
// type
any
```

#### getter: adapterConfig

```js
// type
any
```

#### getter: viewMenuActions

```js
// type
MenuItem[]
```

#### getter: canConfigure

```js
// type
boolean | ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>)
```

#### getter: adapterType

```js
// type
AdapterType
```

### BaseTrackModel - Methods

#### method: saveTrackFileFormatOptions

```js
// type signature
saveTrackFileFormatOptions: () => { gff3: { name: string; extension: string; callback: ({ features }: { features: Feature[]; }) => string; }; genbank: { name: string; extension: string; callback: ({ features, assemblyName, session, }: { assemblyName: string; session: AbstractSessionModel; features: Feature[]; }) => Promise<...>; helpText: stri...
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

### BaseTrackModel - Actions

#### action: setPinned

```js
// type signature
setPinned: (flag: boolean) => void
```

#### action: setMinimized

```js
// type signature
setMinimized: (flag: boolean) => void
```

#### action: showDisplay

```js
// type signature
showDisplay: (displayId: string, initialSnapshot?: {}) => void
```

#### action: hideDisplay

```js
// type signature
hideDisplay: (displayId: string) => number
```

#### action: replaceDisplay

```js
// type signature
replaceDisplay: (oldDisplayId: string, newDisplayId: string, initialSnapshot?: {}) => void
```
