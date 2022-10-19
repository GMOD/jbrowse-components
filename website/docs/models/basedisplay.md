---
id: basedisplay
title: BaseDisplay
toplevel: true
---

#### property: id

```js
id: ElementId
```

#### property: type

```js
type: types.string
```

#### property: rpcDriverName

```js
rpcDriverName: types.maybe(types.string)
```

#### getter: RenderingComponent

```js
// Type
React.FC<{ model: { id: string; type: string; rpcDriverName: string; } & NonEmptyObject & { rendererTypeName: string; error: unknown; } & IStateTreeNode<IModelType<{ id: IOptionalIType<ISimpleType<string>, [...]>; type: ISimpleType<...>; rpcDriverName: IMaybe<...>; }, { ...; }, _NotCustomized, _NotCustomized>>; onHo...
```

#### getter: DisplayBlurb

```js
// Type
any
```

#### getter: adapterConfig

```js
// Type
any
```

#### getter: parentTrack

```js
// Type
any
```

#### method: renderProps

the react props that are passed to the Renderer when data
is rendered in this display

```js
// Type signature
renderProps: () => any
```

#### getter: rendererType

the pluggable element type object for this display's
renderer

```js
// Type
RendererType
```

#### getter: DisplayMessageComponent

if a display-level message should be displayed instead,
make this return a react component

```js
// Type
any
```

#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => MenuItem[]
```

#### getter: viewMenuActions

```js
// Type
MenuItem[]
```

#### method: regionCannotBeRendered

```js
// Type signature
regionCannotBeRendered: () => any
```

#### action: setError

```js
// Type signature
setError: (error?: unknown) => void
```

#### action: setRpcDriverName

```js
// Type signature
setRpcDriverName: (rpcDriverName: string) => void
```

#### action: reload

base display reload does nothing, see specialized displays for details

```js
// Type signature
reload: () => void
```
