---
id: basedisplay
title: BaseDisplay
toplevel: true
---



#### property: id


```js

    /**
     * !property
     */
    id: ElementId
```
#### property: type


```js

    /**
     * !property
     */
    type: types.string
```
#### property: rpcDriverName


```js

    /**
     * !property
     */
    rpcDriverName: types.maybe(types.string)
```
#### getter: RenderingComponent



```js
// Type
React.FC<{ model: { id: string; type: string; rpcDriverName: string; } & NonEmptyObject & { rendererTypeName: string; error: unknown; } & IStateTreeNode<IModelType<{ id: IOptionalIType<ISimpleType<string>, [...]>; type: ISimpleType<...>; rpcDriverName: IMaybe<...>; }, { ...; }, _NotCustomized, _NotCustomized>>; onHo...
```
#### property: type


```js
self.type
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
#### property: type


```js
self.type
```
#### property: id


```js
self.id
```
#### method: renderProps
the react props that are passed to the Renderer when data
is rendered in this display
```js
// Type signature
renderProps: () => any
```
#### property: rpcDriverName


```js
 self.rpcDriverName
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
#### property: rpcDriverName


```js

      self.rpcDriverName
```
#### action: reload


base display reload does nothing, see specialized displays for details
```js
// Type signature
reload: () => void
```
