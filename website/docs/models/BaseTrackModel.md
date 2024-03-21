---
id: basetrackmodel
title: BaseTrackModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/core/pluggableElementTypes/models/BaseTrackModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/pluggableElementTypes/models/BaseTrackModel.ts)

these MST models only exist for tracks that are _shown_. they should contain
only UI state for the track, and have a reference to a track configuration. note
that multiple displayed tracks could use the same configuration.

### BaseTrackModel - Properties

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(baseTrackConfig)
```

#### property: displays

```js
// type signature
IArrayType<IAnyType>
// code
displays: types.array(pm.pluggableMstType('display', 'stateModel'))
```

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: minimized

```js
// type signature
false
// code
minimized: false
```

#### property: type

```js
// type signature
ISimpleType<string>
// code
type: types.literal(trackType)
```

### BaseTrackModel - Getters

#### getter: adapterType

```js
// type
AdapterType
```

#### getter: canConfigure

```js
// type
boolean | ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)
```

#### getter: name

```js
// type
any
```

#### getter: rpcSessionId

determines which webworker to send the track to, currently based on trackId

```js
// type
any
```

#### getter: textSearchAdapter

```js
// type
any
```

#### getter: viewMenuActions

```js
// type
MenuItem[]
```

### BaseTrackModel - Methods

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

### BaseTrackModel - Actions

#### action: hideDisplay

```js
// type signature
hideDisplay: (displayId: string) => number
```

#### action: replaceDisplay

```js
// type signature
replaceDisplay: (oldId: string, newId: string, initialSnapshot?: {}) => void
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
