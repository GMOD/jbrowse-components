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

#### property: type

```js
// type signature
ISimpleType<string>
// code
type: types.string
```

#### property: rpcDriverName

```js
// type signature
IMaybe<ISimpleType<string>>
// code
rpcDriverName: types.maybe(types.string)
```

### BaseDisplay - Getters

#### getter: RenderingComponent

```js
// type
React.FC<{ model: { id: string; type: string; rpcDriverName: string; } & NonEmptyObject & { rendererTypeName: string; error: unknown; message: string | undefined; } & IStateTreeNode<IModelType<{ id: IOptionalIType<...>; type: ISimpleType<...>; rpcDriverName: IMaybe<...>; }, { ...; }, _NotCustomized, _NotCustomized>>...
```

#### getter: DisplayBlurb

```js
// type
any
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

#### getter: DisplayMessageComponent

if a display-level message should be displayed instead, make this return a react
component

```js
// type
any
```

#### getter: viewMenuActions

```js
// type
MenuItem[]
```

### BaseDisplay - Methods

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

#### method: regionCannotBeRendered

```js
// type signature
regionCannotBeRendered: () => any
```

### BaseDisplay - Actions

#### action: setMessage

```js
// type signature
setMessage: (arg?: string) => void
```

#### action: setError

```js
// type signature
setError: (error?: unknown) => void
```

#### action: setRpcDriverName

```js
// type signature
setRpcDriverName: (rpcDriverName: string) => void
```

#### action: reload

base display reload does nothing, see specialized displays for details

```js
// type signature
reload: () => void
```
