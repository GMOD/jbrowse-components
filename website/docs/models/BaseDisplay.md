---
id: basedisplay
title: BaseDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseDisplayModel.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseDisplay.md)

## Docs

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
React.FC<{ model: { id: string; type: string; rpcDriverName: string; } & NonEmptyObject & { rendererTypeName: string; error: unknown; statusMessage: string; } & IStateTreeNode<IModelType<{ id: IOptionalIType<ISimpleType<string>, [...]>; type: ISimpleType<...>; rpcDriverName: IMaybe<...>; }, { ...; }, _NotCustomized,...
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
AbstractTrackModel
```

#### getter: isMinimized

Returns true if the parent track is minimized. Used to skip expensive operations
like autoruns when track is not visible.

```js
// type
any
```

#### getter: parentDisplay

Returns the parent display if this display is nested within another display
(e.g., PileupDisplay inside LinearAlignmentsDisplay)

```js
// type
any
```

#### getter: effectiveRpcDriverName

Returns the effective RPC driver name with hierarchical fallback:

1. This display's explicit rpcDriverName
2. Parent display's effectiveRpcDriverName (for nested displays)
3. Track config's rpcDriverName

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
display. these are serialized and sent to the worker for server-side rendering

```js
// type signature
renderProps: () => any
```

#### method: renderingProps

props passed to the renderer's React "Rendering" component. these are
client-side only and never sent to the worker. includes displayModel and
callbacks

```js
// type signature
renderingProps: () => { displayModel: { id: string; type: string; rpcDriverName: string; } & NonEmptyObject & { rendererTypeName: string; error: unknown; statusMessage: string; } & { readonly RenderingComponent: React.FC<...>; ... 5 more ...; readonly effectiveRpcDriverName: any; } & IStateTreeNode<...>; }
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

#### action: setStatusMessage

```js
// type signature
setStatusMessage: (arg?: string) => void
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
