---
title: Plotting features in a custom display
description:
  Build a plugin that fetches features in a worker and plots them on the main
  thread with Canvas2D, no shaders required
guide_category: Plugins
sidebar_label: Plotting features
---

**TL;DR:** A custom display that fetches features in a worker and draws them
with Canvas2D, no shaders required. Right for gene-scale tracks (hundreds to
thousands of features per frame); move to
[](/docs/developer_guides/creating_gpu_display) only when a profile shows
Canvas2D can't hold 60fps (roughly ≳100K features per frame). Both paths share
the same model, fetch chain, and lifecycle, so starting here never boxes you in.

A [build-step plugin](/docs/developer_guides/simple_plugin), not a
[no-build](/docs/developer_guides/no_build_plugin) one: it bundles
`@jbrowse/render-core` and composes mixins from
`@jbrowse/plugin-linear-genome-view`, whose surface is larger and faster-moving
than [`@jbrowse/core`](/docs/developer_guides/imports_and_reexports), so pin the
versions you develop against. `@jbrowse/render-core` first publishes in the next
release; until then, build against a `jbrowse-components` checkout.

<Figure src="/img/gwas/manhattan.png" caption="A real feature-plotting display built the way this guide describes: plugins/gwas/src/LinearManhattanDisplay fetches scored points in a worker as typed arrays and plots them per block on the main thread. Each point is a GWAS variant positioned by genome coordinate (X) and −log₁₀(p-value) (Y); the tall peak on hg19 chr2 is a strong association."/>

## The mental model

Rendering splits across two threads:

<Figure caption="The worker fetches and packs, the main thread stores per region and draws. The pure draw function backs both the canvas and SVG export." src="/img/feature_plotting_threads.png" />

The worker returns compact data, never pixels, with all genomic positions
absolute (not region-relative). The model owns the fetched data (`rpcDataMap`),
a cheap per-frame `renderState`, and the fetch/draw wiring; mixins supply the
fetch and draw lifecycles. The renderer paints the visible blocks with an
ordinary `CanvasRenderingContext2D`, and the same pure draw function backs SVG
export.

Three terms recur below (the
[architecture spec's vocabulary](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#vocabulary)
is fuller):

- **region**: one entry of `view.displayedRegions`. Your worker fetches and
  stores data one region at a time.
- **block**: a visible slice of a region with its on-screen pixel span. You draw
  per block.
- **`displayedRegionIndex`**: a region's index in `view.displayedRegions`, the
  join key between `rpcDataMap` and the blocks:
  `rpcDataMap.get(block.displayedRegionIndex)`.

The simplest complete in-tree reference is
`plugins/sequence/src/LinearReferenceSequenceDisplay/`, a Canvas2D-only display
whose renderer is ~30 lines; this guide mirrors its shape.

## Files to create

`example-plugins/score-example/` is the finished plugin — a standalone package
CI installs from a packed tarball and asserts renders, so it stays buildable
against the published packages. It ships both renderers, so the `[GPU only]`
rows are the ones a Canvas2D display skips:

<!-- EXAMPLE_PLUGIN_TREE START -->

```
src/
  index.ts                       the plugin class; installs the display, the RPC method and the feature panel
  LinearScoreDisplay/
    configSchema.ts              config slots (color, scoreColumn)
    index.ts                     registers the display type
    model.ts                     MST model: rpcDataMap, renderState, fetchNeeded, startRenderingBackend
    components/
      Canvas2DScoreRenderer.ts   extends Canvas2DPerRegionRenderingBackend; the SVG-export path too
      GpuScoreRenderer.ts        [GPU only] extends GpuPerRegionRenderingBackend; packs instances, writes uniforms
      ScoreDisplayComponent.tsx  React: DisplayChrome wrapping the canvas
      ScoreRendererFactory.ts    the factory DisplayChrome calls; picks GPU or Canvas2D
      drawScore.ts               pure draw function over a Ctx2D
      scoreTypes.ts              ScoreRenderState and the backend type
      shaders/
        score.slang              [GPU only] vertex + fragment for one pass; compiled by gen:shaders
  ScoreFeaturePanel/
    index.tsx                    adds a panel to the feature details widget
  ScoreRPC/
    GetScoreData.ts              worker: fetch features from the adapter, then pack
    buildScoreResult.ts          pure packer, unit-tested without a worker
    index.ts                     registers the RPC method
    rpcTypes.ts                  ScoreRegionData and the RPC arg types
```

<!-- EXAMPLE_PLUGIN_TREE END -->

## Step 1: Define the data the worker returns

Keep it compact and structured-clone-friendly. Use absolute genomic positions.

<!-- include: example-plugins/score-example/src/ScoreRPC/rpcTypes.ts#region-data -->

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

## Step 2: Write the RPC method

The worker fetches from the adapter and packs the result. See
[](/docs/developer_guides/rpc_workers) for the full `RpcMethodType` contract;
the shape is:

`ScoreRPC/GetScoreData.ts`:

<!-- include: example-plugins/score-example/src/ScoreRPC/GetScoreData.ts -->

```ts
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import { buildScoreResult } from './buildScoreResult.ts'

import type { GetScoreDataArgs, ScoreRegionData } from './rpcTypes.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

// Registering the name here is what types `rpcManager.call(…, 'GetScoreData', …)`
// at every call site: the args are checked and the return type is inferred,
// instead of both being `any`.
declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetScoreData: {
      args: GetScoreDataArgs
      return: ScoreRegionData
    }
  }
}

export default class GetScoreData extends RpcMethodType<'GetScoreData'> {
  name = 'GetScoreData' as const

  async execute(args: RpcExecuteArgs<'GetScoreData'>) {
    const {
      sessionId,
      adapterConfig,
      region,
      scoreColumn,
      stopToken,
      statusCallback,
    } = args
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })
    // statusCallback arrives as an ordinary function: the caller's never
    // crossed the boundary, the RPC layer replaced it with a side channel and
    // rebuilt one here. Hand it to whatever does the slow work rather than only
    // bracketing that work, so the message tracks the download.
    statusCallback?.('Fetching features')
    const features = await dataAdapter.getFeaturesArray(region, {
      stopToken,
      statusCallback,
    })
    return buildScoreResult(features, scoreColumn)
  }
}
```

## Step 3: The MST model

Compose `MultiRegionDisplayMixin` (which brings the fetch autoruns **and** the
render lifecycle) and `TrackHeightMixin`. You supply four things: a place to
store fetched data (`rpcDataMap`), a per-frame `renderState`, a `fetchNeeded`
action, and a `startRenderingBackend` action.

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/model.ts -->

```ts
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  fetchEachRegion,
} from '@jbrowse/plugin-linear-genome-view'
import { installPerRegionLifecycle } from '@jbrowse/render-core/installPerRegionLifecycle'
import { observable } from 'mobx'

import type { ScoreRegionData } from '../ScoreRPC/rpcTypes.ts'
import type {
  ScoreRenderState,
  ScoreRenderingBackend,
} from './components/scoreTypes.ts'
import type { LinearScoreDisplayConfigModel } from './configSchema.ts'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function modelFactory(configSchema: LinearScoreDisplayConfigModel) {
  return types
    .compose(
      'LinearScoreDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      types.model({
        type: types.literal('LinearScoreDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      // fetched data keyed by displayedRegionIndex; the render lifecycle
      // uploads/draws one region at a time from this map
      rpcDataMap: observable.map<number, ScoreRegionData>(),
    }))
    .views(self => ({
      get view() {
        return getContainingView(self) as LinearGenomeViewModel
      },
      // fetch inputs watched by SettingsInvalidate; any change refetches. Put
      // settings that change what the worker computes here; never scroll/zoom
      // (those change every frame) or the fetch results themselves.
      rpcProps() {
        return { scoreColumn: getConf(self, 'scoreColumn') }
      },
      // recomputed cheaply every frame without fetching; carries the canvas
      // dimensions (required) plus whatever the draw path reads
      get renderState(): ScoreRenderState {
        return {
          canvasWidth: self.canvasWidthPx,
          canvasHeight: self.height,
          color: getConf(self, 'color'),
        }
      },
    }))
    .actions(self => ({
      setRpcData(idx: number, data: ScoreRegionData) {
        self.rpcDataMap.set(idx, data)
      },
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
      },
    }))
    .actions(self => ({
      // called by the fetch autorun for the regions that need loading;
      // fetchEachRegion handles cancellation, stop tokens and staleness
      fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
        // no `if (!adapterConfig)` guard: the `adapter` slot is a union of the
        // registered adapter schemas, all of which are creatable from an empty
        // snapshot, so MST always materializes an object there and the guard
        // could never fire
        const { adapterConfig } = self
        const sessionId = getRpcSessionId(self)
        const { rpcManager } = getSession(self)
        return fetchEachRegion(self, needed, {
          // rpcManager.call injects sessionId from its first argument, so it
          // does not go in the args object
          call: (region, ctx) =>
            rpcManager.call(sessionId, 'GetScoreData', {
              adapterConfig,
              region,
              ...self.rpcProps(),
              stopToken: ctx.stopToken,
              // the RPC layer replaces this function with a side-channel and
              // calls it on the main thread as the worker reports progress.
              // It is this region's slot in the fetch's fan-out, so the N
              // parallel calls aggregate into one bar
              statusCallback: ctx.statusCallback,
            }),
          onResult: (idx, result) => {
            self.setRpcData(idx, result)
          },
        })
      },
      // called once by DisplayChrome when the backend is created. Streams each
      // region into the backend and draws every frame from renderState. This is
      // the only part of the model that knows a backend exists, and it is
      // identical whether that backend is the GPU or the Canvas2D one.
      startRenderingBackend(backend: ScoreRenderingBackend) {
        installPerRegionLifecycle(self, backend, {
          data: () => self.rpcDataMap,
          render: (b, regions) => {
            if (regions.size === 0) {
              return false // keep the loading overlay up until data lands
            }
            b.renderBlocks(self.renderBlocks, regions, self.renderState)
            return true
          },
        })
      },
    }))
}

export type LinearScoreDisplayStateModel = ReturnType<typeof modelFactory>
export type LinearScoreDisplayModel = Instance<LinearScoreDisplayStateModel>
```

`renderBlocks` (the list of visible blocks with their pixel spans) comes from
`MultiRegionDisplayMixin`, so you don't compute it. The fetch chain
(`fetchNeeded`, `rpcProps`, cancellation, `regionTooLarge`) is documented in
full in [the data fetching pipeline](/docs/developer_guides/data_fetching).

## Step 4: The renderer

The renderer has two parts: a **pure draw function** that paints blocks into any
2D context, and a thin backend class that the lifecycle drives. Keeping the draw
logic pure means SVG export reuses it unchanged (see
[](/docs/developer_guides/svg_export)).

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/components/drawScore.ts -->

```ts
import {
  bpToScreenPx,
  forEachClippedBlock,
} from '@jbrowse/render-core/canvas2dUtils'

import type { ScoreRegionData } from '../../ScoreRPC/rpcTypes.ts'
import type { ScoreRenderState } from './scoreTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Pure draw function: paints the visible blocks into any 2D context. Ctx2D =
// CanvasRenderingContext2D | SvgCanvas, so the same implementation backs both
// on-screen Canvas2D rendering and SVG export.
export function drawScoreBlocks(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, ScoreRegionData>,
  blocks: RenderBlock[],
  state: ScoreRenderState,
) {
  const { canvasWidth, canvasHeight, color } = state
  ctx.fillStyle = color
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

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/components/Canvas2DScoreRenderer.ts -->

```ts
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import { drawScoreBlocks } from './drawScore.ts'

import type { ScoreRegionData } from '../../ScoreRPC/rpcTypes.ts'
import type { ScoreRenderState } from './scoreTypes.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// The base class owns renderBlocks (DPR-aware canvas sizing, then calls draw);
// this subclass implements only the pure paint step. Runs both as the WebGPU/
// WebGL2 fallback and as the SVG-export path.
export class Canvas2DScoreRenderer extends Canvas2DPerRegionRenderingBackend<
  ScoreRegionData,
  ScoreRenderState
> {
  protected draw(
    blocks: RenderBlock[],
    regions: ReadonlyMap<number, ScoreRegionData>,
    state: ScoreRenderState,
  ) {
    drawScoreBlocks(this.ctx, regions, blocks, state)
  }
}
```

Export the factory `DisplayChrome` will call from the same file. A Canvas2D-only
display skips `createRenderingBackend`'s WebGPU→WebGL2→Canvas2D ladder entirely
and returns its backend through `createCanvas2DBackend`, which is the whole
difference from the GPU path's factory. `plugins/sequence` does exactly this:

<!-- include: plugins/sequence/src/LinearReferenceSequenceDisplay/components/Canvas2DSequenceRenderer.ts#factory -->

```ts
// A Canvas2D-only display needs no separate factory file and no HAL ladder:
// createCanvas2DBackend just wraps the backend in the Promise DisplayChrome
// awaits. Swap in createRenderingBackend (and its createGpuBackend option) only
// once a profile shows Canvas2D can't hold 60fps.
export function SequenceRenderer(canvas: HTMLCanvasElement) {
  return createCanvas2DBackend(canvas, c => new Canvas2DSequenceRenderer(c))
}
```

`ScoreRenderState` must include `canvasWidth` and `canvasHeight` (the
`FrameDimensions` the base class needs to size the backing store); add whatever
else your draw function reads:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/components/scoreTypes.ts#render-state -->

```ts
// Recomputed cheaply every frame without fetching. Carries the canvas
// dimensions (required by the base class to size the backing store) plus the
// one setting the draw path reads.
export interface ScoreRenderState {
  canvasWidth: number
  canvasHeight: number
  color: string
}
```

## Step 5: The React component

`DisplayChrome` wraps your canvas with shared status chrome (loading scrim,
error bar, "region too large" banner) and wires the rendering-backend factory
and WebGL/WebGPU context-loss recovery. You give it your factory and render the
`<canvas>` from the `canvasRef` it hands back.

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/components/ScoreDisplayComponent.tsx -->

```tsx
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { ScoreRenderer } from './ScoreRendererFactory.ts'

import type { LinearScoreDisplayModel } from '../model.ts'

// DisplayChrome supplies the display's chrome (loading scrim, error bar,
// region-too-large banner) and WebGL/WebGPU context-loss recovery, and is the
// only place useRenderingBackend is called. Its render-prop hands back the
// canvasRef to attach to the <canvas>.
const ScoreDisplayComponent = observer(function ScoreDisplayComponent({
  model,
}: {
  model: LinearScoreDisplayModel
}) {
  return (
    <DisplayChrome
      model={model}
      factory={ScoreRenderer}
      testid="score-display"
      style={{ width: '100%', height: model.height }}
    >
      {({ canvasRef }) => (
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      )}
    </DisplayChrome>
  )
})

export default ScoreDisplayComponent
```

## Step 6: Register the display

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/index.ts -->

```ts
import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchema } from './configSchema.ts'
import { modelFactory } from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const ScoreDisplayComponent = lazy(
  () => import('./components/ScoreDisplayComponent.tsx'),
)

export default function LinearScoreDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearScoreDisplay',
      configSchema,
      stateModel: modelFactory(configSchema),
      displayName: 'Score display (example)',
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: ScoreDisplayComponent,
    })
  })
}
```

Register the RPC method in the same plugin's `install()` with
`pluginManager.addRpcMethod(() => new GetScoreData(pluginManager))`, and see
[custom track and display types](/docs/developer_guides/creating_display) for
how displays attach to a track type.

## Hit-testing (clicks and hovers)

Hit-testing is plugin-owned and runs on the main thread. It is not part of
rendering. Build a spatial index (e.g.
[`Flatbush`](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/flatbush/index.ts))
from `rpcDataMap` in a cached view, and query it from your React mouse handlers
against the cursor's `(x, y)`. `plugins/gwas`'s `findManhattanHit.ts` is a
worked example.

## SVG export

`drawScoreBlocks` takes a `Ctx2D`, so SVG export calls it with an `SvgCanvas`
and emits vector output from the same code. Add a `renderSvg` action per
[](/docs/developer_guides/svg_export).

## Moving to the GPU path

Everything above carries over unchanged — model, fetch chain, `renderState`,
hit-testing, and the Canvas2D renderer, which SVG export keeps using either way.
You add a `.slang` shader and a GPU renderer, and move the factory from
`createCanvas2DBackend` to `createRenderingBackend`. See
[](/docs/developer_guides/creating_gpu_display).

## In-tree references

- `plugins/sequence/src/LinearReferenceSequenceDisplay/` - the simplest
  Canvas2D-only display (this guide mirrors it)
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
