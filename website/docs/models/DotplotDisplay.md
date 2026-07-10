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

## Members

| Member                                                 | Kind       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                 | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [configuration](#property-configuration)               | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [colorBy](#property-colorby)                           | Properties | color by setting that overrides the config setting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [alpha](#property-alpha)                               | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [minAlignmentLength](#property-minalignmentlength)     | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [rpcData](#volatile-rpcdata)                           | Volatiles  | RPC-computed feature data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [geometry](#volatile-geometry)                         | Volatiles  | GPU-instance geometry produced from featPositions, self- describing via embedded bpPerPx. The containing DotplotView aggregates one of these per display and uploads them to the shared backend keyed by track index.                                                                                                                                                                                                                                                                                                                           |
| [fetchStopToken](#volatile-fetchstoptoken)             | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [fetchWarnings](#volatile-fetchwarnings)               | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [loadedFetchKey](#volatile-loadedfetchkey)             | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [assembliesSwapped](#volatile-assembliesswapped)       | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [isLoading](#getter-isloading)                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [isRefetching](#getter-isrefetching)                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [currentFetchKey](#getter-currentfetchkey)             | Getters    | The fetch-input signature (see fetchKey.ts) for the view's current state. Reactive: recomputes when either axis's zoom or displayed-region order/orientation changes.                                                                                                                                                                                                                                                                                                                                                                           |
| [dataCurrent](#getter-datacurrent)                     | Getters    | True when the rendered rpcData was fetched for the view's current inputs. Goes false the instant a zoom or diagonalize reorder changes the axes — before the debounced refetch begins and while stale geometry is still on screen — so the `settled` done-gate can't fire on it. The dotplot analog of LGV's `viewportWithinLoadedData`.                                                                                                                                                                                                        |
| [warnings](#getter-warnings)                           | Getters    | Per-render fetch warnings, plus the load-time reversed-assembly hint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [svgReady](#getter-svgready)                           | Getters    | Off-screen SVG export gate (see agent-docs/ARCHITECTURE.md, "svgReady"). Dotplot is non-rectangular (square canvas), so it keeps a bespoke `SVGErrorBox` error UI instead of `SvgChrome`, but still exposes `svgReady` + awaits it via the shared `awaitSvgReady` — no inlined `when()`. No `regionTooLarge` state. Stale-safe via `dataCurrent`: an export fired right after a zoom/diagonalize reorder waits for geometry rebuilt from the fresh fetch instead of exporting the stale plot (the follow-up the synteny gate also now carries). |
| [renderSvg](#method-rendersvg)                         | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setLoading](#action-setloading)                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setRpcData](#action-setrpcdata)                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setWarnings](#action-setwarnings)                     | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setAssembliesSwapped](#action-setassembliesswapped)   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setGeometry](#action-setgeometry)                     | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setError](#action-seterror)                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setAlpha](#action-setalpha)                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setMinAlignmentLength](#action-setminalignmentlength) | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setColorBy](#action-setcolorby)                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

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

**Methods:** [renderingProps](../basedisplay#method-renderingprops),
[trackMenuItems](../basedisplay#method-trackmenuitems),
[regionCannotBeRendered](../basedisplay#method-regioncannotberendered)

**Actions:** [setStatusMessage](../basedisplay#action-setstatusmessage),
[setError](../basedisplay#action-seterror),
[setRpcDriverName](../basedisplay#action-setrpcdrivername),
[reload](../basedisplay#action-reload)

<details>
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

<details>
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

#### volatile: loadedFetchKey

```ts
// type signature
type loadedFetchKey = string | undefined
// code
loadedFetchKey: undefined as string | undefined
```

#### volatile: assembliesSwapped

```ts
// type signature
type assembliesSwapped = false
// code
assembliesSwapped: false
```

</details>

<details>
<summary>DotplotDisplay - Getters</summary>

#### getter: currentFetchKey

The fetch-input signature (see fetchKey.ts) for the view's current state.
Reactive: recomputes when either axis's zoom or displayed-region
order/orientation changes.

```ts
type currentFetchKey = string
```

#### getter: dataCurrent

True when the rendered rpcData was fetched for the view's current inputs. Goes
false the instant a zoom or diagonalize reorder changes the axes — before the
debounced refetch begins and while stale geometry is still on screen — so the
`settled` done-gate can't fire on it. The dotplot analog of LGV's
`viewportWithinLoadedData`.

```ts
type dataCurrent = boolean
```

#### getter: warnings

Per-render fetch warnings, plus the load-time reversed-assembly hint.

```ts
type warnings = { message: string; effect: string }[]
```

#### getter: svgReady

Off-screen SVG export gate (see agent-docs/ARCHITECTURE.md, "svgReady"). Dotplot
is non-rectangular (square canvas), so it keeps a bespoke `SVGErrorBox` error UI
instead of `SvgChrome`, but still exposes `svgReady` + awaits it via the shared
`awaitSvgReady` — no inlined `when()`. No `regionTooLarge` state. Stale-safe via
`dataCurrent`: an export fired right after a zoom/diagonalize reorder waits for
geometry rebuilt from the fresh fetch instead of exporting the stale plot (the
follow-up the synteny gate also now carries).

```ts
type svgReady = boolean
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
type setRpcData = (data: DotplotRpcData, fetchKey: string) => void
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
