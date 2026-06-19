---
id: dotplotdisplay
title: DotplotDisplay
sidebar_label: Display -> DotplotDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotDisplay/stateModelFactory.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/DotplotDisplay.md)

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** [id](../basedisplay#property-id),
[type](../basedisplay#property-type),
[rpcDriverName](../basedisplay#property-rpcdrivername)

**Volatiles:** [error](../basedisplay#volatile-error),
[statusMessage](../basedisplay#volatile-statusmessage)

**Getters:** [parentTrack](../basedisplay#getter-parenttrack),
[parentDisplay](../basedisplay#getter-parentdisplay),
[RenderingComponent](../basedisplay#getter-renderingcomponent),
[DisplayBlurb](../basedisplay#getter-displayblurb),
[adapterConfig](../basedisplay#getter-adapterconfig),
[isMinimized](../basedisplay#getter-isminimized),
[effectiveRpcDriverName](../basedisplay#getter-effectiverpcdrivername),
[effectiveTrackConfig](../basedisplay#getter-effectivetrackconfig),
[DisplayMessageComponent](../basedisplay#getter-displaymessagecomponent),
[viewMenuActions](../basedisplay#getter-viewmenuactions)

**Methods:** [renderProps](../basedisplay#method-renderprops),
[renderingProps](../basedisplay#method-renderingprops),
[trackMenuItems](../basedisplay#method-trackmenuitems),
[regionCannotBeRendered](../basedisplay#method-regioncannotberendered)

**Actions:** [setStatusMessage](../basedisplay#action-setstatusmessage),
[setError](../basedisplay#action-seterror),
[setRpcDriverName](../basedisplay#action-setrpcdrivername),
[reload](../basedisplay#action-reload)

<details>
<summary>DotplotDisplay - Properties</summary>

#### property: type

```js
// type signature
ISimpleType<"DotplotDisplay">
// code
type: types.literal('DotplotDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: colorBy

color by setting that overrides the config setting

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
colorBy: types.optional(types.string, 'default')
```

#### property: alpha

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
alpha: types.optional(types.number, 1)
```

#### property: minAlignmentLength

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
minAlignmentLength: types.optional(types.number, 0)
```

</details>

<details>
<summary>DotplotDisplay - Volatiles</summary>

#### volatile: rpcData

RPC-computed feature data

```js
// type signature
DotplotRpcData | undefined
// code
rpcData: undefined as DotplotRpcData | undefined
```

#### volatile: geometry

GPU-instance geometry produced from featPositions, self- describing via embedded
bpPerPx. The containing DotplotView aggregates one of these per display and
uploads them to the shared backend keyed by track index.

```js
// type signature
DotplotGeometryData | undefined
// code
geometry: undefined as DotplotGeometryData | undefined
```

#### volatile: fetchStopToken

```js
// type signature
StopToken | undefined
// code
fetchStopToken: undefined as StopToken | undefined
```

#### volatile: statusProgress

determinate progress fraction [0,1] for the current status, or undefined when
the in-flight phase is indeterminate. Pairs with the `statusMessage` volatile
inherited from BaseDisplay.

```js
// type signature
number | undefined
// code
statusProgress: undefined as number | undefined
```

#### volatile: fetchWarnings

```js
// type signature
{ message: string; effect: string; }[]
// code
fetchWarnings: [] as { message: string; effect: string }[]
```

#### volatile: assembliesSwapped

```js
// type signature
false
// code
assembliesSwapped: false
```

</details>

<details>
<summary>DotplotDisplay - Getters</summary>

#### getter: isLoading

```js
// type
boolean
```

#### getter: isRefetching

```js
// type
boolean
```

#### getter: warnings

Per-render fetch warnings, plus the load-time reversed-assembly hint.

```js
// type
{
  message: string
  effect: string
}
;[]
```

</details>

<details>
<summary>DotplotDisplay - Methods</summary>

#### method: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgOptions & { theme?: ThemeOptions | undefined; }) => Promise<string | number | bigint | boolean | Iterable<ReactNode> | Element | null | undefined>
```

</details>

<details>
<summary>DotplotDisplay - Actions</summary>

#### action: setStatusMessage

Status callback for the in-flight fetch; derives the indeterminate message and
the determinate progress fraction. Overrides BaseDisplay's string-only setter so
the dotplot loading overlay can show a bar.

```js
// type signature
setStatusMessage: (status?: RpcStatus | undefined) => void
```

#### action: setLoading

```js
// type signature
setLoading: (stopToken: StopToken) => void
```

#### action: setRpcData

```js
// type signature
setRpcData: (data: DotplotRpcData) => void
```

#### action: setWarnings

```js
// type signature
setWarnings: (w: { message: string; effect: string; }[]) => void
```

#### action: setAssembliesSwapped

```js
// type signature
setAssembliesSwapped: (arg: boolean) => void
```

#### action: setGeometry

```js
// type signature
setGeometry: (data: DotplotGeometryData | undefined) => void
```

#### action: setError

```js
// type signature
setError: (error: unknown) => void
```

#### action: setAlpha

```js
// type signature
setAlpha: (value: number) => void
```

#### action: setMinAlignmentLength

```js
// type signature
setMinAlignmentLength: (value: number) => void
```

#### action: setColorBy

```js
// type signature
setColorBy: (value: SyntenyColorBy) => void
```

</details>
