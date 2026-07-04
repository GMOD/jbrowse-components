---
id: dotplotdisplay
title: DotplotDisplay
sidebar_label: Display -> DotplotDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`dotplot-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotDisplay/stateModelFactory.tsx).

## Overview

### DotplotDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/dotplotdisplay).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** [id](../basedisplay#property-id),
[type](../basedisplay#property-type),
[rpcDriverName](../basedisplay#property-rpcdrivername)

**Volatiles:** [error](../basedisplay#volatile-error),
[statusMessage](../basedisplay#volatile-statusmessage),
[statusProgress](../basedisplay#volatile-statusprogress)

**Getters:** [parentTrack](../basedisplay#getter-parenttrack),
[parentDisplay](../basedisplay#getter-parentdisplay),
[RenderingComponent](../basedisplay#getter-renderingcomponent),
[DisplayBlurb](../basedisplay#getter-displayblurb),
[adapterConfig](../basedisplay#getter-adapterconfig),
[isMinimized](../basedisplay#getter-isminimized),
[effectiveRpcDriverName](../basedisplay#getter-effectiverpcdrivername),
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

<details open>
<summary>DotplotDisplay - Properties</summary>

#### property: colorBy

color by setting that overrides the config setting

```ts
// type signature
type colorBy = IOptionalIType<ISimpleType<string>, [undefined]>
// code
colorBy: types.optional(types.string, 'default')
```

</details>

<details>
<summary>DotplotDisplay - Properties (other undocumented members)</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'DotplotDisplay'>
// code
type: types.literal('DotplotDisplay')
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: alpha

```ts
// type signature
type alpha = IOptionalIType<ISimpleType<number>, [undefined]>
// code
alpha: types.optional(types.number, 1)
```

#### property: minAlignmentLength

```ts
// type signature
type minAlignmentLength = IOptionalIType<ISimpleType<number>, [undefined]>
// code
minAlignmentLength: types.optional(types.number, 0)
```

</details>

<details open>
<summary>DotplotDisplay - Volatiles</summary>

#### volatile: rpcData

RPC-computed feature data

```ts
// type signature
type rpcData = DotplotRpcData | undefined
// code
rpcData: undefined as DotplotRpcData | undefined
```

#### volatile: geometry

GPU-instance geometry produced from featPositions, self- describing via embedded
bpPerPx. The containing DotplotView aggregates one of these per display and
uploads them to the shared backend keyed by track index.

```ts
// type signature
type geometry = DotplotGeometryData | undefined
// code
geometry: undefined as DotplotGeometryData | undefined
```

</details>

<details>
<summary>DotplotDisplay - Volatiles (other undocumented members)</summary>

#### volatile: fetchStopToken

```ts
// type signature
type fetchStopToken = StopToken | undefined
// code
fetchStopToken: undefined as StopToken | undefined
```

#### volatile: fetchWarnings

```ts
// type signature
type fetchWarnings = { message: string; effect: string }[]
// code
fetchWarnings: [] as { message: string; effect: string }[]
```

#### volatile: assembliesSwapped

```ts
// type signature
type assembliesSwapped = false
// code
assembliesSwapped: false
```

</details>

<details open>
<summary>DotplotDisplay - Getters</summary>

#### getter: warnings

Per-render fetch warnings, plus the load-time reversed-assembly hint.

```ts
type warnings = { message: string; effect: string }[]
```

</details>

<details>
<summary>DotplotDisplay - Getters (other undocumented members)</summary>

#### getter: isLoading

```ts
type isLoading = boolean
```

#### getter: isRefetching

```ts
type isRefetching = boolean
```

</details>

<details>
<summary>DotplotDisplay - Methods</summary>

#### method: renderSvg

```ts
type renderSvg = (
  opts: ExportSvgOptions & { theme?: ThemeOptions | undefined },
) => Promise<
  | string
  | number
  | bigint
  | boolean
  | Iterable<ReactNode>
  | Element
  | null
  | undefined
>
```

</details>

<details>
<summary>DotplotDisplay - Actions</summary>

#### action: setLoading

```ts
type setLoading = (stopToken: StopToken) => void
```

#### action: setRpcData

```ts
type setRpcData = (data: DotplotRpcData) => void
```

#### action: setWarnings

```ts
type setWarnings = (w: { message: string; effect: string }[]) => void
```

#### action: setAssembliesSwapped

```ts
type setAssembliesSwapped = (arg: boolean) => void
```

#### action: setGeometry

```ts
type setGeometry = (data: DotplotGeometryData | undefined) => void
```

#### action: setError

```ts
type setError = (error: unknown) => void
```

#### action: setAlpha

```ts
type setAlpha = (value: number) => void
```

#### action: setMinAlignmentLength

```ts
type setMinAlignmentLength = (value: number) => void
```

#### action: setColorBy

```ts
type setColorBy = (value: SyntenyColorBy) => void
```

</details>
