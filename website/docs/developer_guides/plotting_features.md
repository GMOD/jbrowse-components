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
surface than
[`@jbrowse/core`](/docs/developer_guides/imports_and_reexports) — so pin the
versions you develop against and expect the occasional rename across minor
releases.

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
plugins/myplugin/src/LinearScoreDisplay/
├── model.ts                       MST model: fetch + renderState + lifecycle
├── index.ts                       registers the display type
├── configSchema.ts                config slots (color, height, …)
└── components/
    ├── ScoreDisplayComponent.tsx  React: <DisplayChrome> + <canvas>
    ├── ScoreRenderer.ts           Canvas2DPerRegionRenderingBackend + factory
    ├── drawScore.ts               pure draw function (also used by SVG export)
    └── scoreTypes.ts              ScoreRegionData + ScoreRenderState interfaces
plugins/myplugin/src/ScoreRPC/
├── index.ts                       RPC registration
└── GetScoreData.ts                worker: fetch features → ScoreRegionData
```

## Step 1: Define the data the worker returns

Keep it compact and structured-clone-friendly. Use absolute genomic positions.

```ts
// components/scoreTypes.ts
// what the worker returns per region, stored in the model's rpcDataMap
export interface ScoreRegionData {
  // parallel arrays, one entry per feature
  starts: Uint32Array // absolute genomic bp
  ends: Uint32Array // absolute genomic bp
  scores: Float32Array // 0..1, drives the box height/color
  numFeatures: number
}
```

## Step 2: Write the RPC method

The worker fetches from the adapter and packs the result. See
[RPC and worker system](/docs/developer_guides/rpc_workers) for the full
`RpcMethodType` contract; the shape is:

```ts
// ScoreRPC/GetScoreData.ts
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { firstValueFrom, toArray } from 'rxjs'

import type { ScoreRegionData } from '../LinearScoreDisplay/components/scoreTypes.ts'

export default class GetScoreData extends RpcMethodType {
  name = 'GetScoreData'

  async execute(args: ScoreRpcArgs, rpcDriverClassName: string) {
    const { sessionId, adapterConfig, region, stopToken } =
      await this.deserializeArguments(args, rpcDriverClassName)
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    const features = await firstValueFrom(
      dataAdapter.getFeatures(region, { stopToken }).pipe(toArray()),
    )

    const numFeatures = features.length
    const starts = new Uint32Array(numFeatures)
    const ends = new Uint32Array(numFeatures)
    const scores = new Float32Array(numFeatures)
    features.forEach((f, i) => {
      starts[i] = f.get('start') // absolute bp — no region offset
      ends[i] = f.get('end')
      scores[i] = f.get('score') ?? 0
    })
    return { starts, ends, scores, numFeatures } satisfies ScoreRegionData
  }
}
```

## Step 3: The MST model

Compose `MultiRegionDisplayMixin` (which brings the fetch autoruns **and** the
render lifecycle) and `TrackHeightMixin`. You supply four things: a place to
store fetched data (`rpcDataMap`), a per-frame `renderState`, a `fetchNeeded`
action, and a `startRenderingBackend` action.

```ts
// model.ts
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { type Instance, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  fetchEachRegion,
} from '@jbrowse/plugin-linear-genome-view'
import { installPerRegionLifecycle } from '@jbrowse/render-core/installPerRegionLifecycle'
import { observable } from 'mobx'

import type { Canvas2DScoreRenderer } from './components/ScoreRenderer.ts'
import type {
  ScoreRenderState,
  ScoreRegionData,
} from './components/scoreTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function modelFactory(configSchema: AnyConfigurationSchemaType) {
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
      /**
       * fetch inputs watched by SettingsInvalidate — any change triggers a
       * refetch. Put settings that change *what the worker computes* here;
       * never scroll/zoom (those change every frame) or the fetch results.
       */
      rpcProps() {
        return { color: getConf(self, 'color') }
      },
      /**
       * recomputed cheaply every frame without fetching — carries the canvas
       * dimensions (required) plus anything the draw function needs
       */
      get renderState(): ScoreRenderState {
        return {
          canvasWidth: self.view.trackWidthPx,
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
      /**
       * called by the fetch autorun for the regions that need loading;
       * fetchEachRegion handles cancellation, stop tokens and staleness
       */
      fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
        const { adapterConfig } = self
        if (adapterConfig) {
          const sessionId = getRpcSessionId(self)
          const { rpcManager } = getSession(self)
          return fetchEachRegion(self, needed, {
            call: (region, ctx, displayedRegionIndex) =>
              rpcManager.call(sessionId, 'GetScoreData', {
                sessionId,
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
        }
        return undefined
      },
      /**
       * called once by the canvas machinery when the backend is created.
       * installPerRegionLifecycle streams each region into the backend and
       * runs the render callback every frame. `data => data` is the identity
       * encoder — use it when the RPC result is already the render payload.
       */
      startRenderingBackend(backend: Canvas2DScoreRenderer) {
        installPerRegionLifecycle(
          self,
          self.rpcDataMap,
          backend,
          data => data,
          b => {
            if (self.rpcDataMap.size === 0) {
              return false // keep the loading overlay up until data lands
            }
            b.renderBlocks(self.renderBlocks, self.rpcDataMap, self.renderState)
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

```ts
// components/drawScore.ts
import {
  bpToScreenPx,
  clipBlockForCanvas,
} from '@jbrowse/render-core/canvas2dUtils'

import type { ScoreRenderState, ScoreRegionData } from './scoreTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Ctx2D = CanvasRenderingContext2D | SvgCanvas, so this drives both on-screen
// rendering and SVG export from one implementation.
export function drawScoreBlocks(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, ScoreRegionData>,
  blocks: RenderBlock[],
  state: ScoreRenderState,
) {
  const { canvasHeight, color } = state
  ctx.fillStyle = color
  for (const block of blocks) {
    const data = regions.get(block.displayedRegionIndex)
    const clip = data ? clipBlockForCanvas(block, state.canvasWidth) : undefined
    if (data && clip) {
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
}
```

```ts
// components/ScoreRenderer.ts
import { createCanvas2DBackend } from '@jbrowse/render-core/createRenderingBackend'
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import { drawScoreBlocks } from './drawScore.ts'

import type { ScoreRenderState, ScoreRegionData } from './scoreTypes.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// The base class owns renderBlocks (DPR-aware canvas sizing, then calls draw);
// you implement only the pure paint step.
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

// createCanvas2DBackend skips the GPU/HAL ladder entirely — no shader passes,
// no uniform sizing. This is the Canvas2D-only factory.
export function ScoreRenderer(canvas: HTMLCanvasElement) {
  return createCanvas2DBackend(canvas, c => new Canvas2DScoreRenderer(c))
}
```

`ScoreRenderState` must include `canvasWidth` and `canvasHeight` (the
`FrameDimensions` the base class needs to size the backing store); add whatever
else your draw function reads:

```ts
// components/scoreTypes.ts
export interface ScoreRenderState {
  canvasWidth: number
  canvasHeight: number
  color: string
}
```

## Step 5: The React component

`DisplayChrome` is the shared wrapper that supplies a display's _chrome_: the
UI framing around your canvas (the loading scrim, the error bar, the "region too
large" banner), the same sense as "browser chrome." It also wires the
rendering-backend factory and WebGL/WebGPU context-loss recovery, so every
display gets identical status behavior. You give it your factory and render the
`<canvas>` from the `canvasRef` it hands back; the canvas is the only part your
display draws itself.

```tsx
// components/ScoreDisplayComponent.tsx
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { ScoreRenderer } from './ScoreRenderer.ts'

import type { LinearScoreDisplayModel } from '../model.ts'

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

```ts
// index.ts
import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import ScoreDisplayComponent from './components/ScoreDisplayComponent.tsx'
import { configSchema } from './configSchema.ts'
import { modelFactory } from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearScoreDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearScoreDisplay',
        configSchema,
        stateModel: modelFactory(configSchema),
        displayName: 'Score display',
        trackType: 'FeatureTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: ScoreDisplayComponent,
      }),
  )
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

- `plugins/sequence/src/LinearReferenceSequenceDisplay/` - the simplest
  Canvas2D-only display (this guide mirrors it)
- `plugins/gwas/src/LinearManhattanDisplay/` - a real feature-plotting display
  (scored scatter) that ships both a Canvas2D renderer and a GPU renderer behind
  one model, plus hit-testing and LD coloring
- `plugins/canvas/src/LinearBasicDisplay/` - the fullest reference: the generic
  feature display with the dual GPU + Canvas2D path

## See also

- [Architecture spec](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md)
  - the canonical spec this guide walks through
- [Data fetching pipeline](/docs/developer_guides/data_fetching) - the autorun
  chain, `rpcProps`, cancellation, and `regionTooLarge` behind `fetchNeeded`
- [RPC and worker system](/docs/developer_guides/rpc_workers) - implementing the
  `GetScoreData` method the model calls
- [GPU displays](/docs/developer_guides/creating_gpu_display) - the scale-up
  path for dense datasets
- [Adding SVG export to a display](/docs/developer_guides/svg_export)
- [Custom track and display types](/docs/developer_guides/creating_display) -
  track vs display, registration, and view pairing
- [Configuration schema](/docs/developer_guides/configuration_schema) - defining
  the `color`/`height` slots this display reads
- [Writing a plugin](/docs/developer_guides/simple_plugin) - scaffolding and
  build setup
