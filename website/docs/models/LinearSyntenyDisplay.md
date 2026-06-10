---
id: linearsyntenydisplay
title: LinearSyntenyDisplay
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

## Docs

extends

- [BaseDisplay](../basedisplay)

Pure-data model. The containing LinearSyntenyView owns the shared GPU backend,
the upload autorun (which watches every display's `instanceData` and keys it by
`displayKey`), and the render autorun. This display only carries per-track state
and the `renderParams` the view reads out.

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** id, type, rpcDriverName

**Getters:** parentTrack, parentDisplay, RenderingComponent, DisplayBlurb,
adapterConfig, isMinimized, effectiveRpcDriverName, effectiveTrackConfig,
rendererType, DisplayMessageComponent, viewMenuActions

**Methods:** renderProps, renderingProps, trackMenuItems, regionCannotBeRendered

**Actions:** setStatusMessage, setError, setRpcDriverName, reload

### LinearSyntenyDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearSyntenyDisplay">
// code
type: types.literal('LinearSyntenyDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

### LinearSyntenyDisplay - Volatiles

#### volatile: featureData

```js
// type signature
SyntenyFeatureData | undefined
// code
featureData: undefined as SyntenyFeatureData | undefined
```

#### volatile: instanceData

Raw GPU-instance geometry produced by the RPC. The view observes this on every
display and uploads it to the shared backend keyed by `displayKey`. Clearing it
(undefined) triggers backend eviction.

```js
// type signature
SyntenyGeometry | undefined
// code
instanceData: undefined as SyntenyGeometry | undefined
```

### LinearSyntenyDisplay - Getters

#### getter: parentHelper

```js
// type
{
  height: number
  level: number
}
```

#### getter: displayKey

Stable backend key under the view-shared backend.

```js
// type
number
```

#### getter: height

```js
// type
number
```

#### getter: adapterConfig

```js
// type
any
```

#### getter: trackIds

```js
// type
string[]
```

#### getter: numFeats

```js
// type
number
```

#### getter: warnings

Warnings surfaced in the view header. Flags a likely reversed assembly row
order, detected once at view load (only when the two assemblies have distinct
chromosome names).

```js
// type
{
  message: string
  effect: string
}
;[]
```

#### getter: ready

A fetch has completed (data is present, even if it mapped zero features). Not
`numFeats > 0` — an empty-but-finished fetch is ready, otherwise an empty result
spins the loading overlay forever.

```js
// type
boolean
```

#### getter: loading

Fetch in-flight. Excludes error so error UI and loading UI never show
simultaneously.

```js
// type
boolean
```

#### getter: view

```js
// type
ModelInstanceTypeProps<_OverrideProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; }, { ...; }>, { ...; }>> & ... 17 more ... & IStateTreeNode<...>
```

#### getter: colorSchemeConfig

```js
// type
{ cigarColors: { I: string; N: string; D: string; X: string; M: string; '=': string; }; }
```

#### getter: colorMapWithAlpha

```js
// type
{ I: string; N: string; D: string; X: string; M: string; '=': string; }
```

#### getter: posColorWithAlpha

```js
// type
string
```

#### getter: negColorWithAlpha

```js
// type
string
```

#### getter: queryColorWithAlphaMap

```js
// type
(queryName: string) => string
```

#### getter: computedColors

Main-thread-computed per-instance colors. Recomputes whenever colorBy,
featureData, or instanceData descriptors change — this is the gpuProps half of
the rpcProps/gpuProps split. colorBy changes flow through here without touching
the RPC.

```js
// type
Uint32Array<ArrayBuffer> | undefined
```

#### getter: renderInstanceData

Instance data with main-thread-computed colors substituted in. The view's upload
autorun reads this, so any colorBy change re-fires upload without an RPC
round-trip.

```js
// type
{ colors: Uint32Array<ArrayBuffer>; bp1Hi: Float32Array<ArrayBufferLike>; bp1Lo: Float32Array<ArrayBufferLike>; ... 9 more ...; instanceCount: number; } | undefined
```

#### getter: renderParams

Per-track render params consumed by the view's aggregator. The view substitutes
yTop before handing this to the backend.

```js
// type
{ yTop: number; height: number; alpha: number; minAlignmentLength: number; hoveredFeatureId: number; clickedFeatureId: number; offsetPx0: number; offsetPx1: number; bpPerPx0: number; bpPerPx1: number; drawCurves: boolean; } | undefined
```

### LinearSyntenyDisplay - Actions

#### action: setRpcData

Set both feature and instance data in one MST action so downstream autoruns
(upload, render) fire once per RPC completion, not twice.

```js
// type signature
setRpcData: (featureData: SyntenyFeatureData | undefined, instanceData: SyntenyGeometry | undefined) => void
```
