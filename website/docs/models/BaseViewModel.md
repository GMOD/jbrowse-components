---
id: baseviewmodel
title: BaseViewModel
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See [Core concepts and intro to pluggable
elements](/docs/developer_guide/) for more info

## Docs

### BaseViewModel - Properties

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
ITypeUnion<any, any, any>
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

### BaseViewModel - Getters

#### getter: rpcSessionId

decides how to assign tracks to rpc, by default uses the trackId

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

#### getter: adapterType

```js
// type
AdapterType
```

#### getter: viewMenuActions

```js
// type
MenuItem[]
```

#### getter: canConfigure

```js
// type
any
```

### BaseViewModel - Methods

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

### BaseViewModel - Actions

#### action: s

```js
// type signature
s: () => void
```

#### action: s

```js
// type signature
s: (displayId: string, initialSnapshot?: {}) => void
```

#### action: s

```js
// type signature
s: (displayId: string) => number
```

#### action: s

```js
// type signature
s: (oldId: string, newId: string, initialSnapshot?: {}) => void
```
