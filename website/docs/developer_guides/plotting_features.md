---
title: Plotting features in a custom display
description:
  Build a plugin that fetches features in a worker and plots them on the main
  thread with Canvas2D, no shaders required
guide_category: Plugins
sidebar_label: Plotting features
---

**TL;DR:** A custom display that fetches features in a worker and draws them
with Canvas2D, no shaders required. You write a spec with four parts, the
display's settings, its worker fetch, its painter and optionally a shader, and
`defineDisplay` composes the display type around it. Right for gene-scale tracks
(hundreds to thousands of features per frame); move to
[](/docs/developer_guides/creating_gpu_display) only when a profile shows
Canvas2D can't hold 60fps (roughly ≳100K features per frame). The GPU path is
the same spec with one more block.

A [build-step plugin](/docs/developer_guides/simple_plugin), not a
[no-build](/docs/developer_guides/no_build_plugin) one: it bundles
`@jbrowse/display-kit` and `@jbrowse/render-core`, whose surfaces are larger and
faster-moving than
[`@jbrowse/core`](/docs/developer_guides/imports_and_reexports), so pin the
versions you develop against. Both **first publish in the next release** and
land `@experimental`; until then, build against a `jbrowse-components` checkout.

<Figure src="/img/gwas/manhattan.png" caption="A real feature-plotting display built the way this guide describes: plugins/gwas/src/LinearManhattanDisplay fetches scored points in a worker as typed arrays and plots them per block on the main thread. Each point is a GWAS variant positioned by genome coordinate (X) and −log₁₀(p-value) (Y); the tall peak on hg19 chr2 is a strong association."/>

## Rendering across two threads

Rendering splits across two threads:

<Figure caption="The worker fetches and packs, the main thread stores per region and draws. The pure draw function backs both the canvas and SVG export." src="/img/feature_plotting_threads.png" />

The worker returns compact data, never pixels, with all genomic positions
absolute (not region-relative). The spec's `data` function is the worker half
and its `paint` function is the main-thread half. The factory stores what `data`
returns per region (`rpcDataMap`), decides which regions need fetching, and
calls `paint` with the visible blocks whenever anything on screen changes.

Three terms recur below (the
[architecture spec's vocabulary](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#vocabulary)
is fuller):

- **region**: one entry of `view.displayedRegions`. `data` runs once per region.
- **block**: a visible slice of a region with its on-screen pixel span. `paint`
  draws per block.
- **`displayedRegionIndex`**: a region's index in `view.displayedRegions`, the
  join key between the per-region payloads and the blocks:
  `regions.get(block.displayedRegionIndex)`.

## What the factory does for you

`defineDisplay` (`packages/display-kit/src/defineDisplay.tsx`) builds the layers
an in-tree display spells by hand: the config schema from your `params`, an MST
model composing `MultiRegionDisplayMixin` and `TrackHeightMixin` with
`rpcProps`, `renderState` and `fetchNeeded` derived from the spec, an
`RpcMethodType` subclass that runs `data` in the worker, a
`Canvas2DPerRegionRenderingBackend` that calls `paint`, the `installUpload`
render lifecycle, a React component rendering the canvas through
`DisplayChrome`, and SVG export through `renderDisplaySvg`. Those names are
where to read when a display outgrows the spec; the
[architecture spec's display stacks](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#display-stacks)
and
[GPU_RENDERING.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md)
describe each, and `plugins/gwas/src/LinearManhattanDisplay/` is a display
written that way.

## Files to create

`example-plugins/score-example/` is the finished plugin, a standalone package CI
installs from a packed tarball and asserts renders, so it stays buildable
against the published packages. The display is one file; the `[GPU only]` row
and the `gpu` block inside that file are what a Canvas2D display skips:

<!-- EXAMPLE_PLUGIN_TREE START -->

```
src/
  index.ts            the plugin class; installs the display and the feature panel
  scoreDisplay.ts     the whole display: settings, worker fetch, painter, shader passes
  ScoreFeaturePanel/
    index.tsx         adds a panel to the feature details widget
  shaders/
    score.slang       [GPU only] vertex + fragment for one pass; compiled by gen:shaders
```

<!-- EXAMPLE_PLUGIN_TREE END -->

## Declare the settings

Every setting the display has goes in `params`. Each entry is an ordinary config
slot (`type`, `defaultValue`, `description`), so it lands on the display's
config schema and the user edits it in the track's configuration editor, plus an
`affects` that says what changing it invalidates:

<!-- include: example-plugins/score-example/src/scoreDisplay.ts#params -->

```ts
// Every setting the display has, and what changing it invalidates: `fetch`
// re-runs the worker, `frame` only redraws. The factory derives the RPC cache
// key from the `fetch` set, so a fetch result can never end up in one.
const params = {
  color: {
    type: 'color',
    defaultValue: '#0068d1',
    description: 'fill color for every score box',
    affects: 'frame',
  },
  scoreColumn: {
    type: 'string',
    defaultValue: 'score',
    description: 'feature attribute used as the score',
    affects: 'fetch',
  },
} as const
```

- **`fetch`**: the worker reads it. The factory builds the RPC cache key from
  this set, so a change refetches every region. Only these params reach `data`.
- **`frame`**: only `paint` reads it. A change redraws and fetches nothing.
- **`encode`**: a setting the main-thread buffer packing reads, the third bucket
  the architecture spec calls
  [`gpuProps()`](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#rpcprops--gpuprops-pattern).
  This display has none.

Scroll and zoom are never params: they change every frame and arrive through the
blocks. [The data fetching pipeline](/docs/developer_guides/data_fetching)
explains the cache key the `fetch` set becomes.

`as const` matters: it is what lets `DataContext` type `params` as the `fetch`
subset and `paint` see every value with its literal type.

## Define the data the worker returns

Keep it compact and structured-clone-friendly. Use absolute genomic positions.

<!-- include: example-plugins/score-example/src/scoreDisplay.ts#region-data -->

```ts
// One region's worth of features packed into parallel typed arrays. Positions
// are absolute genomic uint32 (never region-relative) so they cross the worker
// boundary without precision loss and the renderer can map them directly.
export interface ScoreRegionData {
  starts: Uint32Array
  ends: Uint32Array
  // score normalized to 0..1 (fraction of the region's max), driving box height
  scores: Float32Array
  numFeatures: number
}
```

The packer that builds it is a pure function, kept apart from the fetch so
`scoreDisplay.test.ts` covers it without a worker, an adapter or a plugin
manager:

<!-- include: example-plugins/score-example/src/scoreDisplay.ts#pack -->

```ts
// Pure packer: features -> parallel typed arrays. Kept separate from the fetch
// so it unit-tests without a worker, an adapter, or a plugin manager. Scores
// are normalized to 0..1 against the region's own max so the box heights read
// regardless of the raw score scale.
export function buildScoreResult(
  features: Feature[],
  scoreColumn: string,
): ScoreRegionData {
  const scored = features.filter(f => Number.isFinite(f.get(scoreColumn)))
  const numFeatures = scored.length
  const starts = new Uint32Array(numFeatures)
  const ends = new Uint32Array(numFeatures)
  const scores = new Float32Array(numFeatures)

  let maxScore = 0
  for (const f of scored) {
    maxScore = Math.max(maxScore, f.get(scoreColumn) as number)
  }
  const norm = maxScore || 1

  scored.forEach((f, i) => {
    starts[i] = f.get('start')
    ends[i] = f.get('end')
    scores[i] = (f.get(scoreColumn) as number) / norm
  })

  return { starts, ends, scores, numFeatures }
}
```

## Fetch in the worker

`data` runs in the worker, once per region. It is handed a `DataContext`: the
track's `adapter`, already resolved from the track config in the worker, the
`region`, the `fetch` subset of `params`, and the call's `stopToken` and
`statusCallback`:

<!-- include: example-plugins/score-example/src/scoreDisplay.ts#data -->

```ts
// Runs in the worker, once per region. `statusCallback` and `stopToken` go to
// whatever does the slow work rather than only bracketing it, so the progress
// message tracks the download and a cancel reaches it mid-fetch.
export async function fetchScoreData({
  adapter,
  region,
  params,
  stopToken,
  statusCallback,
}: DataContext<ScoreParams>) {
  statusCallback('Fetching features')
  const features = await adapter.getFeaturesArray(region, {
    stopToken,
    statusCallback,
  })
  return buildScoreResult(features, params.scoreColumn)
}
```

Pass `stopToken` and `statusCallback` through to whatever does the slow work.
The factory wires them to the display's cancel button and loading bar, and a
fetch that only brackets its work with them cannot be cancelled mid-download and
reports no progress. [](/docs/developer_guides/rpc_workers) covers what they are
on each side of the boundary.

## Paint

`paint` is a pure function over any 2D context: `Ctx2D` is
`CanvasRenderingContext2D | SvgCanvas`, so the same implementation is the
on-screen Canvas2D renderer and the SVG export. It receives the per-region
payloads, the visible blocks, and a `DisplayRenderState`: the canvas box plus
every param, resolved.

<!-- include: example-plugins/score-example/src/scoreDisplay.ts#paint -->

```ts
// Pure draw function: paints the visible blocks into any 2D context. Ctx2D =
// CanvasRenderingContext2D | SvgCanvas, so the same implementation backs the
// on-screen Canvas2D fallback and SVG export.
export const drawScoreBlocks: Paint<ScoreRegionData, ScoreParams> = (
  ctx,
  regions,
  blocks,
  { canvasWidth, canvasHeight, params },
) => {
  ctx.fillStyle = params.color
  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    canvasHeight,
    block => regions.get(block.displayedRegionIndex),
    (data, block) => {
      const { start, end, screenStartPx, screenEndPx, reversed } = block
      for (let i = 0; i < data.numFeatures; i++) {
        const left = bpToScreenPx(
          data.starts[i]!,
          start,
          end,
          screenStartPx,
          screenEndPx,
          reversed,
        )
        const right = bpToScreenPx(
          data.ends[i]!,
          start,
          end,
          screenStartPx,
          screenEndPx,
          reversed,
        )
        const h = data.scores[i]! * canvasHeight
        ctx.fillRect(
          Math.min(left, right),
          canvasHeight - h,
          Math.abs(right - left) || 1,
          h,
        )
      }
    },
  )
}
```

`forEachClippedBlock` clips to each block's pixel span and hands the draw
callback whatever your lookup returns for that block, here the payload keyed by
`displayedRegionIndex`; `bpToScreenPx` maps an absolute position into the block,
honoring `reversed`. Canvas2D is
[the floor every display ships](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_RENDERING.md#canvas2d-is-the-floor-gpu-is-the-optional-accelerator):
SVG export runs this function, and a shader, when one is added, is an
accelerator layered on top of it.

## Define and install

`defineDisplay` takes the parts. `name` is the display type and the config
schema's `type`; `trackType` is the track it attaches to:

<!-- include: example-plugins/score-example/src/scoreDisplay.ts#define -->

```ts
export const LinearScoreDisplay = defineDisplay({
  name: 'LinearScoreDisplay',
  displayName: 'Score display (example)',
  trackType: 'FeatureTrack',
  params,
  data: fetchScoreData,
  paint: drawScoreBlocks,
  gpu: scoreGpu,
})
```

A Canvas2D-only display leaves `gpu` out. The result carries `install`, which
registers the display type and the RPC method that runs `data`. Call it from the
plugin's `install`, which runs on the main thread and in every worker alike;
that is what puts `data` where the adapter is:

<!-- include: example-plugins/score-example/src/index.ts -->

```ts
import Plugin from '@jbrowse/core/Plugin'

import ScoreFeaturePanelF from './ScoreFeaturePanel/index.tsx'
import { LinearScoreDisplay } from './scoreDisplay.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class ScoreExamplePlugin extends Plugin {
  name = 'ScoreExamplePlugin'

  install(pluginManager: PluginManager) {
    LinearScoreDisplay.install(pluginManager)
    ScoreFeaturePanelF(pluginManager)
  }
}
```

See [custom track and display types](/docs/developer_guides/creating_display)
for how a display attaches to a track type, and
[](/docs/developer_guides/extension_points) for the feature panel the plugin
also installs.

## Hit-testing (clicks and hovers)

Hit-testing is plugin-owned and runs on the main thread, separately from
rendering, and the spec has no hook for it. A display that answers clicks builds
a spatial index (e.g.
[`Flatbush`](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/flatbush/index.ts))
from the per-region payloads in `rpcDataMap` and queries it from its own pointer
handlers against the cursor's `(x, y)`. `plugins/gwas`'s `findManhattanHit.ts`
is a worked example over a hand-written model.

## SVG export

Nothing to add: `paint` takes a `Ctx2D`, so the factory's `renderSvg` calls it
with an `SvgCanvas` and emits vector output from the same code.
[](/docs/developer_guides/svg_export) is the contract it satisfies, for a
display written without the factory.

## Moving to the GPU path

Everything above carries over unchanged: `params`, `data`, `paint`, which SVG
export keeps using either way, and the `defineDisplay` call. You add a `.slang`
shader and a `gpu` block naming its passes and uniforms. See
[](/docs/developer_guides/creating_gpu_display).

## In-tree references

In-tree displays spell the layers the factory composes by hand, so they are
where to read when a display needs more than the spec offers:

- `plugins/sequence/src/LinearReferenceSequenceDisplay/` - the simplest
  Canvas2D-only display
- `plugins/gwas/src/LinearManhattanDisplay/` - a real feature-plotting display
  (scored scatter) that ships both renderers behind one model, plus hit-testing
  and LD coloring
- `plugins/canvas/src/LinearBasicDisplay/` - the fullest reference: the generic
  feature display with the dual GPU + Canvas2D path

## See also

- [](/docs/developer_guides/creating_display)
- [](/docs/developer_guides/data_fetching)
- [](/docs/developer_guides/rpc_workers)
- [](/docs/developer_guides/svg_export)
- [](/docs/developer_guides/creating_gpu_display)
