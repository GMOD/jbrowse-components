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

| Member                                                     | Kind       | Defined by                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ---------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                     | Properties | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [configuration](#property-configuration)                   | Properties | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [colorBy](#property-colorby)                               | Properties | DotplotDisplay                | color by setting that overrides the config setting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [alpha](#property-alpha)                                   | Properties | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [minAlignmentLength](#property-minalignmentlength)         | Properties | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [rpcData](#volatile-rpcdata)                               | Volatiles  | DotplotDisplay                | RPC-computed feature data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [geometry](#volatile-geometry)                             | Volatiles  | DotplotDisplay                | GPU-instance geometry produced from featPositions, self- describing via embedded bpPerPx. The containing DotplotView aggregates one of these per display and uploads them to the shared backend keyed by track index.                                                                                                                                                                                                                                                                                                                           |
| [fetchStopToken](#volatile-fetchstoptoken)                 | Volatiles  | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [fetchWarnings](#volatile-fetchwarnings)                   | Volatiles  | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [loadedFetchKey](#volatile-loadedfetchkey)                 | Volatiles  | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [assembliesSwapped](#volatile-assembliesswapped)           | Volatiles  | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [isLoading](#getter-isloading)                             | Getters    | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [isRefetching](#getter-isrefetching)                       | Getters    | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [currentFetchKey](#getter-currentfetchkey)                 | Getters    | DotplotDisplay                | The fetch-input signature (see fetchKey.ts) for the view's current state. Reactive: recomputes when either axis's zoom or displayed-region order/orientation changes.                                                                                                                                                                                                                                                                                                                                                                           |
| [dataCurrent](#getter-datacurrent)                         | Getters    | DotplotDisplay                | True when the rendered rpcData was fetched for the view's current inputs. Goes false the instant a zoom or diagonalize reorder changes the axes — before the debounced refetch begins and while stale geometry is still on screen — so the `settled` done-gate can't fire on it. The dotplot analog of LGV's `viewportWithinLoadedData`.                                                                                                                                                                                                        |
| [warnings](#getter-warnings)                               | Getters    | DotplotDisplay                | Per-render fetch warnings, plus the load-time reversed-assembly hint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [svgReady](#getter-svgready)                               | Getters    | DotplotDisplay                | Off-screen SVG export gate (see agent-docs/ARCHITECTURE.md, "svgReady"). Dotplot is non-rectangular (square canvas), so it keeps a bespoke `SVGErrorBox` error UI instead of `SvgChrome`, but still exposes `svgReady` + awaits it via the shared `awaitSvgReady` — no inlined `when()`. No `regionTooLarge` state. Stale-safe via `dataCurrent`: an export fired right after a zoom/diagonalize reorder waits for geometry rebuilt from the fresh fetch instead of exporting the stale plot (the follow-up the synteny gate also now carries). |
| [renderSvg](#method-rendersvg)                             | Methods    | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setLoading](#action-setloading)                           | Actions    | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setRpcData](#action-setrpcdata)                           | Actions    | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setWarnings](#action-setwarnings)                         | Actions    | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setAssembliesSwapped](#action-setassembliesswapped)       | Actions    | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setGeometry](#action-setgeometry)                         | Actions    | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setError](#action-seterror)                               | Actions    | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setAlpha](#action-setalpha)                               | Actions    | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setMinAlignmentLength](#action-setminalignmentlength)     | Actions    | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setColorBy](#action-setcolorby)                           | Actions    | DotplotDisplay                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [id](#property-id)                                         | Properties | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [rpcDriverName](#property-rpcdrivername)                   | Properties | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [error](#volatile-error)                                   | Volatiles  | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [statusMessage](#volatile-statusmessage)                   | Volatiles  | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [statusProgress](#volatile-statusprogress)                 | Volatiles  | [BaseDisplay](../basedisplay) | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate. Set alongside `statusMessage` by `setStatusMessage`; a display that never shows a bar simply leaves it undefined.                                                                                                                                                                                                                                                                                                           |
| [parentTrack](#getter-parenttrack)                         | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [parentDisplay](#getter-parentdisplay)                     | Getters    | [BaseDisplay](../basedisplay) | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                                                                                                                                                                                                                                                                                                |
| [RenderingComponent](#getter-renderingcomponent)           | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [DisplayBlurb](#getter-displayblurb)                       | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [adapterConfig](#getter-adapterconfig)                     | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [isMinimized](#getter-isminimized)                         | Getters    | [BaseDisplay](../basedisplay) | Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)   | Getters    | [BaseDisplay](../basedisplay) | Returns the effective RPC driver name with hierarchical fallback: 1. This display's explicit rpcDriverName 2. Parent display's effectiveRpcDriverName (for nested displays) 3. Track config's rpcDriverName                                                                                                                                                                                                                                                                                                                                     |
| [DisplayMessageComponent](#getter-displaymessagecomponent) | Getters    | [BaseDisplay](../basedisplay) | if a display-level message should be displayed instead, make this return a react component                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [renderingProps](#method-renderingprops)                   | Methods    | [BaseDisplay](../basedisplay) | props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks                                                                                                                                                                                                                                                                                                                                                                                        |
| [trackMenuItems](#method-trackmenuitems)                   | Methods    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [regionCannotBeRendered](#method-regioncannotberendered)   | Methods    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setStatusMessage](#action-setstatusmessage)               | Actions    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setRpcDriverName](#action-setrpcdrivername)               | Actions    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [reload](#action-reload)                                   | Actions    | [BaseDisplay](../basedisplay) | base display reload does nothing, see specialized displays for details                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### DotplotDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/dotplotdisplay).

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
) => Promise<Element | null>
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

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseDisplay</summary>

[BaseDisplay →](../basedisplay)

**Properties**

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: rpcDriverName

```ts
// type signature
type rpcDriverName = IMaybe<ISimpleType<string>>
// code
rpcDriverName: types.maybe(types.string)
```

**Volatiles**

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

**Getters**

#### getter: parentTrack

```ts
type parentTrack = AbstractTrackModel
```

#### getter: parentDisplay

Returns the parent display if this display is nested within another display
(e.g., PileupDisplay inside LinearAlignmentsDisplay)

```ts
type parentDisplay =
  | { type?: string | undefined; effectiveRpcDriverName?: string | undefined }
  | undefined
```

#### getter: RenderingComponent

```ts
type RenderingComponent = FC<{ model: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }> & { ...; } & { ...; } & IStateTreeNode<...>; onHorizontalScroll?: ((distance: number) => void) | undefined; blockState?: Record<...> | undefined; }>
```

#### getter: DisplayBlurb

```ts
type DisplayBlurb = FC<{ model: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }> & { ...; } & { ...; } & IStateTreeNode<...>; }> | null
```

#### getter: adapterConfig

```ts
type adapterConfig = any
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

**Methods**

#### method: renderingProps

props passed to the renderer's React "Rendering" component. these are
client-side only and never sent to the worker. includes displayModel and
callbacks

```ts
type renderingProps = () => { displayModel: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }> & { ...; } & { ...; } & { ...; } & IStateTreeNode<...>; }
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => MenuItem[]
```

#### method: regionCannotBeRendered

```ts
type regionCannotBeRendered = () => null
```

**Actions**

#### action: setStatusMessage

```ts
type setStatusMessage = (status?: RpcStatus | undefined) => void
```

#### action: setRpcDriverName

```ts
type setRpcDriverName = (rpcDriverName: string) => void
```

#### action: reload

base display reload does nothing, see specialized displays for details

```ts
type reload = () => void
```

</details>
