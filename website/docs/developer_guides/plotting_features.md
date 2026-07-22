---
title: Plotting features in a custom display
description:
  Build a plugin that fetches features in a worker and plots them on the main
  thread with Canvas2D, no shaders required
guide_category: Creating pluggable elements
---

This guide walks through a custom display that draws your own features into a
linear genome view, the common case where you have a data file and want to plot
each feature as a box, point, line, or any other mark. It uses the **Canvas2D
path**, which needs no shader authoring and is the right choice for gene-scale
annotation tracks (hundreds to thousands of features per frame).

If you profile your display and Canvas2D can't hold 60fps at your real feature
counts (roughly ≳100K features per frame, e.g. whole-genome GWAS, dense
methylation, million-point scatters), move to the GPU path in
[GPU displays](/docs/developer_guides/creating_gpu_display). The two paths share
the same model shape, the same fetch chain, and the same lifecycle (only the
renderer differs), so starting on Canvas2D never boxes you in.

This is a **build-step plugin** path: it bundles `@jbrowse/render-core` and
composes mixins from `@jbrowse/plugin-linear-genome-view`, neither of which a
[no-build plugin](/docs/developer_guides/no_build_plugin) can pull in. You're
building against those two packages' exported APIs — a larger, faster-moving
surface than [`@jbrowse/core`](/docs/developer_guides/imports_and_reexports) —
so pin the versions you develop against and expect the occasional rename across
minor releases.

<Figure src="/img/gwas/manhattan.png" caption="A real feature-plotting display built the way this guide describes: plugins/gwas/src/LinearManhattanDisplay fetches scored points in a worker as typed arrays and plots them per block on the main thread. Each point is a GWAS variant positioned by genome coordinate (X) and −log₁₀(p-value) (Y); the tall peak on hg19 chr2 is a strong association."/>

## The mental model

Rendering splits across two threads:

```
Worker (RPC)                     Main thread (MST model + Canvas2D)
────────────                     ──────────────────────────────────
fetch features from adapter  →   store per region in rpcDataMap
pack into plain/typed data       compute renderState each frame (no fetch)
return (absolute uint32 bp)  →   draw the visible blocks into a <canvas>
```

- The worker fetches and returns compact data, never pixels. All genomic
  positions crossing the worker boundary are absolute (not region-relative).
- The model owns the fetched data (`rpcDataMap`), a cheap per-frame
  `renderState`, and the fetch/draw wiring. Mixins supply the fetch lifecycle
  and the draw lifecycle; you don't write autoruns by hand.
- The renderer is a small class that paints the visible blocks with an ordinary
  `CanvasRenderingContext2D`. The same pure draw function backs SVG export.

A few terms recur throughout the code below (the
[architecture spec's vocabulary](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#vocabulary)
is the fuller list):

- **region** — one entry of `view.displayedRegions` (a chromosome or a
  sub-interval of one). Your worker fetches, and your model stores, data one
  region at a time.
- **block** — a visible slice of a region with its on-screen pixel span. One
  region can produce several blocks; you draw per block.
- **`displayedRegionIndex`** — the zero-based index of a region in
  `view.displayedRegions`. It's the join key between the model's `rpcDataMap`
  and the blocks: `rpcDataMap.get(block.displayedRegionIndex)` fetches the data
  for the region a block belongs to.

The simplest complete in-tree reference is
`plugins/sequence/src/LinearReferenceSequenceDisplay/`, a Canvas2D-only display
whose renderer is ~30 lines; this guide mirrors its shape. The
[architecture spec](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md)
is the canonical reference for the lifecycle below (see
[Canvas2D is the floor, GPU is the optional accelerator](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#canvas2d-is-the-floor-gpu-is-the-optional-accelerator)).

## Files to create

```
src/LinearScoreDisplay/
├── model.ts                       MST model: fetch + renderState + lifecycle
├── index.ts                       registers the display type
├── configSchema.ts                config slots (color, height, …)
└── components/
    ├── ScoreDisplayComponent.tsx  React: <DisplayChrome> + <canvas>
    ├── ScoreRendererFactory.ts    createRenderingBackend dispatch
    ├── Canvas2DScoreRenderer.ts   extends Canvas2DPerRegionRenderingBackend
    ├── drawScore.ts               pure draw function (also used by SVG export)
    └── scoreTypes.ts              ScoreRenderState + backend type
src/ScoreRPC/
├── index.ts                       RPC registration
├── GetScoreData.ts                worker: fetch features -> ScoreRegionData
├── buildScoreResult.ts            pure packer (unit-tested)
└── rpcTypes.ts                    ScoreRegionData + RPC arg types
```

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
[RPC and worker system](/docs/developer_guides/rpc_workers) for the full
`RpcMethodType` contract; the shape is:

`ScoreRPC/GetScoreData.ts`:

<!-- include: example-plugins/score-example/src/ScoreRPC/GetScoreData.ts -->

```ts
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import { buildScoreResult } from './buildScoreResult.ts'

import type { GetScoreDataArgs, ScoreRegionData } from './rpcTypes.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetScoreData: {
      args: GetScoreDataArgs
      return: ScoreRegionData
    }
  }
}

export default class GetScoreData extends RpcMethodType {
  name = 'GetScoreData'

  async execute(args: GetScoreDataArgs, rpcDriverClassName: string) {
    const { sessionId, adapterConfig, region, scoreColumn, stopToken } =
      await this.deserializeArguments(args, rpcDriverClassName)
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })
    const features = await dataAdapter.getFeaturesArray(region, { stopToken })
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
      // fetched data keyed by displayedRegionIndex — the render lifecycle
      // uploads/draws one region at a time from this map
      rpcDataMap: observable.map<number, ScoreRegionData>(),
    }))
    .views(self => ({
      get view() {
        return getContainingView(self) as LinearGenomeViewModel
      },
      // fetch inputs watched by SettingsInvalidate — any change refetches. Put
      // settings that change what the worker computes here; never scroll/zoom
      // (those change every frame) or the fetch results themselves.
      rpcProps() {
        return { scoreColumn: getConf(self, 'scoreColumn') }
      },
      // recomputed cheaply every frame without fetching; carries the canvas
      // dimensions (required) plus whatever the draw path reads
      get renderState(): ScoreRenderState {
        return {
          canvasWidth: this.view.trackWidthPx,
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
        const { adapterConfig } = self
        if (!adapterConfig) {
          return undefined
        }
        const sessionId = getRpcSessionId(self)
        const { rpcManager } = getSession(self)
        return fetchEachRegion(self, needed, {
          // rpcManager.call injects sessionId itself, so it is not in the args
          call: (region, ctx, displayedRegionIndex) =>
            rpcManager.call(sessionId, 'GetScoreData', {
              adapterConfig,
              region,
              ...self.rpcProps(),
              stopToken: ctx.stopToken,
              statusCallback:
                self.makeRegionStatusCallback(displayedRegionIndex),
            }),
          onResult: (idx, result) => {
            self.setRpcData(idx, result)
          },
        })
      },
      // called once by DisplayChrome when the backend is created. Streams each
      // region into the backend and draws every frame from renderState.
      startRenderingBackend(backend: ScoreRenderingBackend) {
        installPerRegionLifecycle(
          self,
          self.rpcDataMap,
          backend,
          data => data,
          (b, regions) => {
            if (regions.size === 0) {
              return false // keep the loading overlay up until data lands
            }
            b.renderBlocks(self.renderBlocks, regions, self.renderState)
            return true
          },
        )
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
[SVG export](/docs/developer_guides/svg_export)).

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/components/drawScore.ts -->

```ts
import {
  bpToScreenPx,
  clipBlockForCanvas,
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
  for (const block of blocks) {
    const data = regions.get(block.displayedRegionIndex)
    const clip = data ? clipBlockForCanvas(block, canvasWidth) : undefined
    if (!data || !clip) {
      continue
    }
    const { start, end, screenStartPx, screenEndPx, reversed } = block
    ctx.save()
    ctx.beginPath()
    ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
    ctx.clip()
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
    ctx.restore()
  }
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

`DisplayChrome` is the shared wrapper that supplies a display's _chrome_: the UI
framing around your canvas (the loading scrim, the error bar, the "region too
large" banner), the same sense as "browser chrome." It also wires the
rendering-backend factory and WebGL/WebGPU context-loss recovery, so every
display gets identical status behavior. You give it your factory and render the
`<canvas>` from the `canvasRef` it hands back; the canvas is the only part your
display draws itself.

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

Because `drawScoreBlocks` takes a `Ctx2D`, SVG export calls the exact same
function with an `SvgCanvas` and emits vector output, with no second rendering
implementation. Add a `renderSvg` action per
[SVG export](/docs/developer_guides/svg_export).

## When to move to the GPU path

Stay on Canvas2D until a profile shows it can't keep up. The GPU path (WebGPU
with WebGL2/Canvas2D fallback) becomes worth its extra cost (a `.slang` shader,
an instance packer, a GPU backend class) only at high feature counts. The model,
fetch chain, `renderState`, and hit-testing you wrote here carry over unchanged;
you add a GPU renderer and swap `createCanvas2DBackend` for
`createRenderingBackend`. See
[GPU displays](/docs/developer_guides/creating_gpu_display).

## In-tree references

- `example-plugins/score-example/` - the complete plugin this guide builds, as a
  standalone package. CI installs it from a packed tarball and asserts it
  renders, so it stays buildable against the published packages
- `plugins/sequence/src/LinearReferenceSequenceDisplay/` - the simplest
  Canvas2D-only display (this guide mirrors it)
- `plugins/gwas/src/LinearManhattanDisplay/` - a real feature-plotting display
  (scored scatter) that ships both a Canvas2D renderer and a GPU renderer behind
  one model, plus hit-testing and LD coloring
- `plugins/canvas/src/LinearBasicDisplay/` - the fullest reference: the generic
  feature display with the dual GPU + Canvas2D path

## See also

- [Custom track and display types](/docs/developer_guides/creating_display)
- [Data fetching pipeline](/docs/developer_guides/data_fetching)
- [RPC and worker system](/docs/developer_guides/rpc_workers)
- [GPU displays](/docs/developer_guides/creating_gpu_display)
- [Adding SVG export to a display](/docs/developer_guides/svg_export)
