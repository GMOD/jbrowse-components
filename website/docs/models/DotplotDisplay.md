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

| Member                                                         | Kind       | Defined by                    | Description                                                                                                                         |
| -------------------------------------------------------------- | ---------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                         | Properties | DotplotDisplay                |                                                                                                                                     |
| [configuration](#property-configuration)                       | Properties | DotplotDisplay                |                                                                                                                                     |
| [colorBy](#property-colorby)                                   | Properties | DotplotDisplay                | color by setting that overrides the config setting                                                                                  |
| [alpha](#property-alpha)                                       | Properties | DotplotDisplay                |                                                                                                                                     |
| [minAlignmentLength](#property-minalignmentlength)             | Properties | DotplotDisplay                |                                                                                                                                     |
| [rpcData](#volatile-rpcdata)                                   | Volatiles  | DotplotDisplay                | RPC-computed feature data                                                                                                           |
| [geometry](#volatile-geometry)                                 | Volatiles  | DotplotDisplay                | GPU-instance geometry produced from featPositions, self- describing via embedded bpPerPx.                                           |
| [fetchStopToken](#volatile-fetchstoptoken)                     | Volatiles  | DotplotDisplay                |                                                                                                                                     |
| [fetchWarnings](#volatile-fetchwarnings)                       | Volatiles  | DotplotDisplay                |                                                                                                                                     |
| [loadedFetchKey](#volatile-loadedfetchkey)                     | Volatiles  | DotplotDisplay                |                                                                                                                                     |
| [assembliesSwapped](#volatile-assembliesswapped)               | Volatiles  | DotplotDisplay                |                                                                                                                                     |
| [isLoading](#getter-isloading)                                 | Getters    | DotplotDisplay                |                                                                                                                                     |
| [isRefetching](#getter-isrefetching)                           | Getters    | DotplotDisplay                |                                                                                                                                     |
| [currentFetchKey](#getter-currentfetchkey)                     | Getters    | DotplotDisplay                | The fetch-input signature (see fetchKey.ts) for the view's current state.                                                           |
| [dataCurrent](#getter-datacurrent)                             | Getters    | DotplotDisplay                | True when the rendered rpcData was fetched for the view's current inputs.                                                           |
| [warnings](#getter-warnings)                                   | Getters    | DotplotDisplay                | Per-render fetch warnings, plus the load-time reversed-assembly hint.                                                               |
| [svgReady](#getter-svgready)                                   | Getters    | DotplotDisplay                | Off-screen SVG export gate (see agent-docs/ARCHITECTURE.md, "svgReady").                                                            |
| [renderSvg](#method-rendersvg)                                 | Methods    | DotplotDisplay                |                                                                                                                                     |
| [setLoading](#action-setloading)                               | Actions    | DotplotDisplay                |                                                                                                                                     |
| [setRpcData](#action-setrpcdata)                               | Actions    | DotplotDisplay                |                                                                                                                                     |
| [setWarnings](#action-setwarnings)                             | Actions    | DotplotDisplay                |                                                                                                                                     |
| [setAssembliesSwapped](#action-setassembliesswapped)           | Actions    | DotplotDisplay                |                                                                                                                                     |
| [setGeometry](#action-setgeometry)                             | Actions    | DotplotDisplay                |                                                                                                                                     |
| [setError](#action-seterror)                                   | Actions    | DotplotDisplay                |                                                                                                                                     |
| [setAlpha](#action-setalpha)                                   | Actions    | DotplotDisplay                |                                                                                                                                     |
| [setMinAlignmentLength](#action-setminalignmentlength)         | Actions    | DotplotDisplay                |                                                                                                                                     |
| [setColorBy](#action-setcolorby)                               | Actions    | DotplotDisplay                |                                                                                                                                     |
| [id](#property-id)                                             | Properties | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [rpcDriverName](#property-rpcdrivername)                       | Properties | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)     | Properties | [BaseDisplay](../basedisplay) | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL). |
| [error](#volatile-error)                                       | Volatiles  | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [statusMessage](#volatile-statusmessage)                       | Volatiles  | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [statusProgress](#volatile-statusprogress)                     | Volatiles  | [BaseDisplay](../basedisplay) | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate.                 |
| [parentTrack](#getter-parenttrack)                             | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [parentDisplay](#getter-parentdisplay)                         | Getters    | [BaseDisplay](../basedisplay) | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)    |
| [RenderingComponent](#getter-renderingcomponent)               | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [DisplayBlurb](#getter-displayblurb)                           | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [adapterConfig](#getter-adapterconfig)                         | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [isMinimized](#getter-isminimized)                             | Getters    | [BaseDisplay](../basedisplay) | Returns true if the parent track is minimized.                                                                                      |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)       | Getters    | [BaseDisplay](../basedisplay) | Returns the effective RPC driver name with hierarchical fallback: 1.                                                                |
| [DisplayMessageComponent](#getter-displaymessagecomponent)     | Getters    | [BaseDisplay](../basedisplay) | if a display-level message should be displayed instead, make this return a react component                                          |
| [renderingProps](#method-renderingprops)                       | Methods    | [BaseDisplay](../basedisplay) | props passed to the renderer's React "Rendering" component.                                                                         |
| [trackMenuItems](#method-trackmenuitems)                       | Methods    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [regionCannotBeRendered](#method-regioncannotberendered)       | Methods    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults) | Actions    | [BaseDisplay](../basedisplay) | see the `ignorePromotedDefaults` property                                                                                           |
| [setStatusMessage](#action-setstatusmessage)                   | Actions    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [setRpcDriverName](#action-setrpcdrivername)                   | Actions    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [reload](#action-reload)                                       | Actions    | [BaseDisplay](../basedisplay) | base display reload does nothing, see specialized displays for details                                                              |

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

| Member                                                           | Type                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------- |
| <span id="property-type">type</span>                             | `ISimpleType<"DotplotDisplay">`                       |
| <span id="property-configuration">configuration</span>           | `IConfigurationReference<AnyConfigurationSchemaType>` |
| <span id="property-alpha">alpha</span>                           | `IOptionalIType<ISimpleType<number>, [undefined]>`    |
| <span id="property-minalignmentlength">minAlignmentLength</span> | `IOptionalIType<ISimpleType<number>, [undefined]>`    |

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

| Member                                                         | Type                                     |
| -------------------------------------------------------------- | ---------------------------------------- |
| <span id="volatile-fetchstoptoken">fetchStopToken</span>       | `StopToken \| undefined`                 |
| <span id="volatile-fetchwarnings">fetchWarnings</span>         | `{ message: string; effect: string; }[]` |
| <span id="volatile-loadedfetchkey">loadedFetchKey</span>       | `string \| undefined`                    |
| <span id="volatile-assembliesswapped">assembliesSwapped</span> | `false`                                  |

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

| Member                                             | Type      |
| -------------------------------------------------- | --------- |
| <span id="getter-isloading">isLoading</span>       | `boolean` |
| <span id="getter-isrefetching">isRefetching</span> | `boolean` |

</details>

<details>
<summary>DotplotDisplay - Methods</summary>

| Member                                       | Type                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| <span id="method-rendersvg">renderSvg</span> | `(opts: ExportSvgOptions & { theme?: ThemeOptions \| undefined; }) => Promise<Element \| null>` |

</details>

<details>
<summary>DotplotDisplay - Actions</summary>

| Member                                                               | Type                                                                                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-setloading">setLoading</span>                       | `(stopToken: StopToken) => void`                                                                                                        |
| <span id="action-setrpcdata">setRpcData</span>                       | `(data: DotplotRpcData, fetchKey: string) => void`                                                                                      |
| <span id="action-setwarnings">setWarnings</span>                     | `(w: { message: string; effect: string; }[]) => void`                                                                                   |
| <span id="action-setassembliesswapped">setAssembliesSwapped</span>   | `(arg: boolean) => void`                                                                                                                |
| <span id="action-setgeometry">setGeometry</span>                     | `(data: DotplotGeometryData \| undefined) => void`                                                                                      |
| <span id="action-seterror">setError</span>                           | `(error: unknown) => void`                                                                                                              |
| <span id="action-setalpha">setAlpha</span>                           | `(value: number) => void`                                                                                                               |
| <span id="action-setminalignmentlength">setMinAlignmentLength</span> | `(value: number) => void`                                                                                                               |
| <span id="action-setcolorby">setColorBy</span>                       | `(value: "default" \| "strand" \| "query" \| "target" \| "reference" \| "identity" \| "meanQueryIdentity" \| "mappingQuality") => void` |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseDisplay</summary>

[BaseDisplay →](../basedisplay)

**Properties**

#### property: ignorePromotedDefaults

true for a display that arrived inside a session received from someone else (a
share link, an encoded/json session, a `spec-` URL). Such a display resolves its
`promotable` config slots from its own config only, never from this browser's
promoted display-type defaults (see `configuration/promotableDefaults.ts`) — the
received session is a record of what the sender saw, and a local preference
silently repainting it would make it a lie. A track opened _afterwards_ in that
same session is a fresh track of this user's, so it never gets the flag and
picks up their defaults normally. Cleared by `resetSlotsToInherit` when the user
deliberately makes the display follow a default.

```ts
// type signature
type ignorePromotedDefaults = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
ignorePromotedDefaults: types.stripDefault(types.boolean, false)
```

| Member                                                 | Type                                               |
| ------------------------------------------------------ | -------------------------------------------------- |
| <span id="property-id">id</span>                       | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-rpcdrivername">rpcDriverName</span> | `IMaybe<ISimpleType<string>>`                      |

**Volatiles**

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

| Member                                                 | Type                  |
| ------------------------------------------------------ | --------------------- |
| <span id="volatile-error">error</span>                 | `unknown`             |
| <span id="volatile-statusmessage">statusMessage</span> | `string \| undefined` |

**Getters**

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

| Member                                                         | Type                                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| <span id="getter-parenttrack">parentTrack</span>               | `AbstractTrackModel`                                                                            |
| <span id="getter-renderingcomponent">RenderingComponent</span> | `FC<…>`                                                                                         |
| <span id="getter-displayblurb">DisplayBlurb</span>             | `FC<{ model: ModelInstanceTypeProps<…> & { ...; } & { ...; } & IStateTreeNode<...>; }> \| null` |
| <span id="getter-adapterconfig">adapterConfig</span>           | `any`                                                                                           |

**Methods**

#### method: renderingProps

props passed to the renderer's React "Rendering" component. these are
client-side only and never sent to the worker. includes displayModel and
callbacks

```ts
type renderingProps = () => { displayModel: ModelInstanceTypeProps<…> & { ...; } & { ...; } & { ...; } & IStateTreeNode<...>; }
```

| Member                                                                 | Type               |
| ---------------------------------------------------------------------- | ------------------ |
| <span id="method-trackmenuitems">trackMenuItems</span>                 | `() => MenuItem[]` |
| <span id="method-regioncannotberendered">regionCannotBeRendered</span> | `() => null`       |

**Actions**

#### action: setIgnorePromotedDefaults

see the `ignorePromotedDefaults` property

```ts
type setIgnorePromotedDefaults = (flag: boolean) => void
```

#### action: reload

base display reload does nothing, see specialized displays for details

```ts
type reload = () => void
```

| Member                                                     | Type                                        |
| ---------------------------------------------------------- | ------------------------------------------- |
| <span id="action-setstatusmessage">setStatusMessage</span> | `(status?: RpcStatus \| undefined) => void` |
| <span id="action-setrpcdrivername">setRpcDriverName</span> | `(rpcDriverName: string) => void`           |

</details>
