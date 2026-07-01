---
id: linearsyntenydisplay
title: LinearSyntenyDisplay
sidebar_label: Display -> LinearSyntenyDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearSyntenyDisplay.md)

## Example usage

A complete `SyntenyTrack` config to paste into `tracks`. The adapter needs the
query (first) and target (second) assembly names, matched by the track's
`assemblyNames`:

```js
{
  type: 'SyntenyTrack',
  trackId: 'hg38_vs_mm10',
  name: 'hg38 vs mm10',
  assemblyNames: ['hg38', 'mm10'],
  adapter: {
    type: 'PAFAdapter',
    uri: 'https://example.com/hg38_vs_mm10.paf',
    queryAssembly: 'hg38',
    targetAssembly: 'mm10',
  },
  displays: [
    {
      type: 'LinearSyntenyDisplay',
      displayId: 'hg38_vs_mm10-LinearSyntenyDisplay',
    },
  ],
}
```

## Overview

Pure-data model. The containing LinearSyntenyView owns the shared GPU backend,
the upload autorun (which watches every display's `instanceData` and keys it by
`displayKey`), and the render autorun. This display only carries per-track state
and the `renderParams` the view reads out.

### LinearSyntenyDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearsyntenydisplay).

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

<details open>
<summary>LinearSyntenyDisplay - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                             |
| ------------------------------------------ | ------------------------------------- |
| [`type`](#property-type)                   | `ISimpleType<"LinearSyntenyDisplay">` |
| [`configuration`](#property-configuration) | `ITypeUnion<any, any, any>`           |

</details>

<details>
<summary>LinearSyntenyDisplay - Properties (all signatures)</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearSyntenyDisplay'>
// code
type: types.literal('LinearSyntenyDisplay')
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details open>
<summary>LinearSyntenyDisplay - Volatiles</summary>

#### volatile: instanceData

Raw GPU-instance geometry produced by the RPC. The view observes this on every
display and uploads it to the shared backend keyed by `displayKey`. Clearing it
(undefined) triggers backend eviction.

```ts
// type signature
type instanceData = SyntenyGeometry | undefined
// code
instanceData: undefined as SyntenyGeometry | undefined
```

#### volatile: statusProgress

determinate progress fraction [0,1] for the current status, or undefined when
the in-flight phase is indeterminate

```ts
// type signature
type statusProgress = number | undefined
// code
statusProgress: undefined as number | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                             | Signature                         |
| -------------------------------------------------- | --------------------------------- |
| [`featureData`](#volatile-featuredata)             | `SyntenyFeatureData \| undefined` |
| [`hoveredFeatureIdx`](#volatile-hoveredfeatureidx) | `number`                          |
| [`clickedFeatureIdx`](#volatile-clickedfeatureidx) | `number`                          |
| [`contextMenuAnchor`](#volatile-contextmenuanchor) | `ClickCoord \| undefined`         |
| [`fetching`](#volatile-fetching)                   | `false`                           |
| [`statusMessage`](#volatile-statusmessage)         | `string \| undefined`             |
| [`assembliesSwapped`](#volatile-assembliesswapped) | `false`                           |

</details>

<details>
<summary>LinearSyntenyDisplay - Volatiles (all signatures)</summary>

#### volatile: featureData

```ts
// type signature
type featureData = SyntenyFeatureData | undefined
// code
featureData: undefined as SyntenyFeatureData | undefined
```

#### volatile: hoveredFeatureIdx

```ts
// type signature
type hoveredFeatureIdx = number
// code
hoveredFeatureIdx: -1
```

#### volatile: clickedFeatureIdx

```ts
// type signature
type clickedFeatureIdx = number
// code
clickedFeatureIdx: -1
```

#### volatile: contextMenuAnchor

```ts
// type signature
type contextMenuAnchor = ClickCoord | undefined
// code
contextMenuAnchor: undefined as ClickCoord | undefined
```

#### volatile: fetching

```ts
// type signature
type fetching = false
// code
fetching: false
```

#### volatile: statusMessage

```ts
// type signature
type statusMessage = string | undefined
// code
statusMessage: undefined as string | undefined
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
<summary>LinearSyntenyDisplay - Getters</summary>

#### getter: displayKey

Stable backend key under the view-shared backend.

```ts
type displayKey = number
```

#### getter: warnings

Warnings surfaced in the view header. Flags a likely reversed assembly row
order, detected once at view load (only when the two assemblies have distinct
chromosome names).

```ts
type warnings = { message: string; effect: string }[]
```

#### getter: ready

A fetch has completed (data is present, even if it mapped zero features). Not
`numFeats > 0` — an empty-but-finished fetch is ready, otherwise an empty result
spins the loading overlay forever.

```ts
type ready = boolean
```

#### getter: loading

First load: a fetch is running and no data has arrived yet. Excludes error so
error UI and loading UI never show simultaneously. Drives the full striped
LoadingOverlay.

```ts
type loading = boolean
```

#### getter: refetching

Refetch in-flight: a new fetch is running but stale ribbons are still on screen
(e.g. zoom-out across a log2 bucket, region change). Drives a subtle corner
indicator instead of the full overlay so the visible ribbons aren't masked on
every viewport change.

```ts
type refetching = boolean
```

#### getter: computedColors

Main-thread-computed per-instance colors. Recomputes whenever colorBy,
featureData, or instanceData descriptors change — this is the gpuProps half of
the rpcProps/gpuProps split. colorBy changes flow through here without touching
the RPC.

```ts
type computedColors = Uint32Array<ArrayBuffer> | undefined
```

#### getter: renderInstanceData

Instance data with main-thread-computed colors substituted in. The view's upload
autorun reads this, so any colorBy change re-fires upload without an RPC
round-trip.

```ts
type renderInstanceData = { colors: Uint32Array<ArrayBuffer>; bp1Hi: Float32Array<ArrayBufferLike>; bp1Lo: Float32Array<ArrayBufferLike>; ... 9 more ...; instanceCount: number; } | undefined
```

#### getter: connectedViews

The two adjacent genome views this level draws between, or undefined until both
are initialized with regions. A level draws between an adjacent pair, so both
render and fetch depend only on those two views, not the whole stack. Single
source of truth for that gate.

```ts
type connectedViews = { v0: ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<...>; }, { ...; }>> & ... 19 more ... & IStateTreeNode<...>; v1: ModelInstanceTypeProps<...> & ... 19 more ... & IStateTreeNode<...>; } | undefined
```

#### getter: renderParams

Per-track render params consumed by the view's aggregator. The view substitutes
yTop before handing this to the backend.

```ts
type renderParams =
  | {
      yTop: number
      height: number
      alpha: number
      fadeThinAlignments: boolean
      minAlignmentLength: number
      hoveredFeatureId: number
      clickedFeatureId: number
      offsetPx0: number
      offsetPx1: number
      bpPerPx0: number
      bpPerPx1: number
      drawCurves: boolean
    }
  | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                   | Signature                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`parentHelper`](#getter-parenthelper)   | `{ height: number; level: number; }`                                                                                                                                                                                                                                              |
| [`level`](#getter-level)                 | `number`                                                                                                                                                                                                                                                                          |
| [`height`](#getter-height)               | `number`                                                                                                                                                                                                                                                                          |
| [`adapterConfig`](#getter-adapterconfig) | `any`                                                                                                                                                                                                                                                                             |
| [`numFeats`](#getter-numfeats)           | `number`                                                                                                                                                                                                                                                                          |
| [`view`](#getter-view)                   | `ModelInstanceTypeProps<_OverrideProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>> & ... 17 more ... & IStateTreeNode<...>` |
| [`tooltipText`](#getter-tooltiptext)     | `string`                                                                                                                                                                                                                                                                          |

</details>

<details>
<summary>LinearSyntenyDisplay - Getters (all signatures)</summary>

#### getter: parentHelper

```ts
type parentHelper = { height: number; level: number }
```

#### getter: level

```ts
type level = number
```

#### getter: height

```ts
type height = number
```

#### getter: adapterConfig

```ts
type adapterConfig = any
```

#### getter: numFeats

```ts
type numFeats = number
```

#### getter: view

```ts
type view = ModelInstanceTypeProps<_OverrideProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>> & ... 17 more ... & IStateTreeNode<...>
```

#### getter: tooltipText

```ts
type tooltipText = string
```

</details>

<details open>
<summary>LinearSyntenyDisplay - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                             | Signature                                 |
| ---------------------------------- | ----------------------------------------- |
| [`getFeature`](#method-getfeature) | `(index: number) => FeatPos \| undefined` |

</details>

<details>
<summary>LinearSyntenyDisplay - Methods (all signatures)</summary>

#### method: getFeature

```ts
type getFeature = (index: number) => FeatPos | undefined
```

</details>

<details open>
<summary>LinearSyntenyDisplay - Actions</summary>

#### action: setRpcData

Set both feature and instance data in one MST action so downstream autoruns
(upload, render) fire once per RPC completion, not twice.

```ts
type setRpcData = (
  featureData: SyntenyFeatureData | undefined,
  instanceData: SyntenyGeometry | undefined,
) => void
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                 | Signature                                   |
| ------------------------------------------------------ | ------------------------------------------- |
| [`setStatusMessage`](#action-setstatusmessage)         | `(status?: RpcStatus \| undefined) => void` |
| [`setFetching`](#action-setfetching)                   | `(arg: boolean) => void`                    |
| [`setAssembliesSwapped`](#action-setassembliesswapped) | `(arg: boolean) => void`                    |
| [`setHoveredFeatureIdx`](#action-sethoveredfeatureidx) | `(idx: number) => void`                     |
| [`setClickedFeatureIdx`](#action-setclickedfeatureidx) | `(idx: number) => void`                     |
| [`openContextMenu`](#action-opencontextmenu)           | `(anchor: ClickCoord) => void`              |
| [`closeContextMenu`](#action-closecontextmenu)         | `() => void`                                |

</details>

<details>
<summary>LinearSyntenyDisplay - Actions (all signatures)</summary>

#### action: setStatusMessage

```ts
type setStatusMessage = (status?: RpcStatus | undefined) => void
```

#### action: setFetching

```ts
type setFetching = (arg: boolean) => void
```

#### action: setAssembliesSwapped

```ts
type setAssembliesSwapped = (arg: boolean) => void
```

#### action: setHoveredFeatureIdx

```ts
type setHoveredFeatureIdx = (idx: number) => void
```

#### action: setClickedFeatureIdx

```ts
type setClickedFeatureIdx = (idx: number) => void
```

#### action: openContextMenu

```ts
type openContextMenu = (anchor: ClickCoord) => void
```

#### action: closeContextMenu

```ts
type closeContextMenu = () => void
```

</details>
