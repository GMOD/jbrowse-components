---
id: basedisplay
title: BaseDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/core/pluggableElementTypes/models/BaseDisplayModel.tsx](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/pluggableElementTypes/models/BaseDisplayModel.tsx)

### BaseDisplay - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: rpcDriverName

```js
// type signature
IMaybe<ISimpleType<string>>
// code
rpcDriverName: types.maybe(types.string)
```

#### property: type

```js
// type signature
ISimpleType<string>
// code
type: types.string
```

### BaseDisplay - Getters

#### getter: DisplayBlurb

```js
// type
any
```

#### getter: DisplayMessageComponent

if a display-level message should be displayed instead, make this return a react
component

```js
// type
any
```

#### getter: RenderingComponent

```js
// type
React.FC<{ model: { id: string; rpcDriverName: string; type: string; } & NonEmptyObject & { error: unknown; message: string; rendererTypeName: string; } & IStateTreeNode<IModelType<{ id: IOptionalIType<ISimpleType<string>, [...]>; rpcDriverName: IMaybe<...>; type: ISimpleType<...>; }, { ...; }, _NotCustomized, _NotC...
```

#### getter: adapterConfig

```js
// type
any
```

#### getter: parentTrack

```js
// type
any
```

#### getter: rendererType

the pluggable element type object for this display's renderer

```js
// type
RendererType
```

#### getter: viewMenuActions

```js
// type
MenuItem[]
```

### BaseDisplay - Methods

#### method: regionCannotBeRendered

```js
// type signature
regionCannotBeRendered: () => any
```

#### method: renderProps

the react props that are passed to the Renderer when data is rendered in this
display

```js
// type signature
renderProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

### BaseDisplay - Actions

#### action: reload

base display reload does nothing, see specialized displays for details

```js
// type signature
reload: () => void
```

#### action: setError

```js
// type signature
setError: (error?: unknown) => void
```

#### action: setMessage

```js
// type signature
setMessage: (arg?: string) => void
```

#### action: setRpcDriverName

```js
// type signature
setRpcDriverName: (rpcDriverName: string) => void
```
