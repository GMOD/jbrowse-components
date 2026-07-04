---
id: basedisplay
title: BaseDisplay
sidebar_label: Display -> BaseDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseDisplayModel.tsx).

## Overview

<details>
<summary>BaseDisplay - Properties</summary>

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
type: types.string
```

#### property: rpcDriverName

```ts
// type signature
type rpcDriverName = IMaybe<ISimpleType<string>>
// code
rpcDriverName: types.maybe(types.string)
```

</details>

<details open>
<summary>BaseDisplay - Volatiles</summary>

#### volatile: statusProgress

determinate progress fraction [0,1] for the current status, or undefined when
the in-flight phase is indeterminate. Set alongside `statusMessage` by
`setStatusMessage`; a display that never shows a bar simply leaves it undefined.

```ts
// type signature
type statusProgress = number | undefined
// code
statusProgress: undefined as number | undefined
```

</details>

<details>
<summary>BaseDisplay - Volatiles (other undocumented members)</summary>

#### volatile: error

```ts
// type signature
type error = unknown
// code
error: undefined as unknown
```

#### volatile: statusMessage

```ts
// type signature
type statusMessage = string | undefined
// code
statusMessage: undefined as string | undefined
```

</details>

<details open>
<summary>BaseDisplay - Getters</summary>

#### getter: parentDisplay

Returns the parent display if this display is nested within another display
(e.g., PileupDisplay inside LinearAlignmentsDisplay)

```ts
type parentDisplay =
  | { type?: string | undefined; effectiveRpcDriverName?: string | undefined }
  | undefined
```

#### getter: isMinimized

Returns true if the parent track is minimized. Used to skip expensive operations
like autoruns when track is not visible.

```ts
type isMinimized = boolean
```

#### getter: effectiveRpcDriverName

Returns the effective RPC driver name with hierarchical fallback:

1. This display's explicit rpcDriverName
2. Parent display's effectiveRpcDriverName (for nested displays)
3. Track config's rpcDriverName

```ts
type effectiveRpcDriverName = any
```

#### getter: DisplayMessageComponent

if a display-level message should be displayed instead, make this return a react
component

```ts
type DisplayMessageComponent = FC<any> | undefined
```

</details>

<details>
<summary>BaseDisplay - Getters (other undocumented members)</summary>

#### getter: parentTrack

```ts
type parentTrack = AbstractTrackModel
```

#### getter: RenderingComponent

```ts
type RenderingComponent = FC<{ model: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }> & { ...; } & { ...; } & IStateTreeNode<...>; onHorizontalScroll?: (() => void) | undefined; blockState?: Record<...> | undefined; }>
```

#### getter: DisplayBlurb

```ts
type DisplayBlurb = FC<{ model: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }> & { ...; } & { ...; } & IStateTreeNode<...>; }> | null
```

#### getter: adapterConfig

```ts
type adapterConfig = any
```

#### getter: viewMenuActions

```ts
type viewMenuActions = MenuItem[]
```

</details>

<details open>
<summary>BaseDisplay - Methods</summary>

#### method: renderProps

the react props that are passed to the Renderer when data is rendered in this
display. these are serialized and sent to the worker for server-side rendering

```ts
type renderProps = () => { notReady: boolean; rpcDriverName: any }
```

#### method: renderingProps

props passed to the renderer's React "Rendering" component. these are
client-side only and never sent to the worker. includes displayModel and
callbacks

```ts
type renderingProps = () => { displayModel: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }> & { ...; } & { ...; } & { ...; } & IStateTreeNode<...>; }
```

</details>

<details>
<summary>BaseDisplay - Methods (other undocumented members)</summary>

#### method: trackMenuItems

```ts
type trackMenuItems = () => MenuItem[]
```

#### method: regionCannotBeRendered

```ts
type regionCannotBeRendered = () => null
```

</details>

<details open>
<summary>BaseDisplay - Actions</summary>

#### action: reload

base display reload does nothing, see specialized displays for details

```ts
type reload = () => void
```

</details>

<details>
<summary>BaseDisplay - Actions (other undocumented members)</summary>

#### action: setStatusMessage

```ts
type setStatusMessage = (status?: RpcStatus | undefined) => void
```

#### action: setError

```ts
type setError = (error?: unknown) => void
```

#### action: setRpcDriverName

```ts
type setRpcDriverName = (rpcDriverName: string) => void
```

</details>
