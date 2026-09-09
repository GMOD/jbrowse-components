---
title: Plotting features in a custom display
description:
  Build a plugin that fetches features in a worker and declares what it draws as
  a mark list, which every backend and the SVG export draw
guide_category: Plugins
sidebar_label: Plotting features
---

**TL;DR:** A custom display that fetches features in a worker and declares what
it draws as a list of **marks** — a shape bound to the display's payload. With
one of the two shared shapes you write no shader, no painter and no hit test;
`createMarkBackend` turns the list into the WebGPU, WebGL2 and Canvas2D
backends, and the same painter is the SVG export. Only a drawing neither shared
shape fits needs a shape of its own, which is
[](/docs/developer_guides/creating_gpu_display).

A [build-step plugin](/docs/developer_guides/simple_plugin), not a
[no-build](/docs/developer_guides/no_build_plugin) one: it bundles
`@jbrowse/render-core` and composes mixins from
`@jbrowse/plugin-linear-genome-view`, whose surface is larger and faster-moving
than [`@jbrowse/core`](/docs/developer_guides/imports_and_reexports), so pin the
versions you develop against. `@jbrowse/render-core` first publishes in the next
release; until then, build against a `jbrowse-components` checkout.

<Figure src="/img/gwas/manhattan.png" caption="A real feature-plotting display built the way this guide describes: plugins/gwas/src/LinearManhattanDisplay fetches scored points in a worker as typed arrays and declares one mark over the shared point shape. Each point is a GWAS variant positioned by genome coordinate (X) and −log₁₀(p-value) (Y); the tall peak on hg19 chr2 is a strong association."/>

## Rendering across two threads

Rendering splits across two threads:

<Figure caption="The worker fetches and packs, the main thread stores per region and draws. The shape's painter backs both the Canvas2D fallback and the SVG export." src="/img/feature_plotting_threads.png" />

The worker returns compact data, never pixels, with all genomic positions
absolute (not region-relative). The model owns the fetched data (`rpcDataMap`),
a cheap per-frame `renderState`, and the fetch/draw wiring; mixins supply the
fetch and draw lifecycles. The mark list says which of the payload's arrays feed
which lane of a shape, and the backend built from it paints the visible blocks —
on the GPU where there is one, through the shape's Canvas2D painter where there
is not, and through that same painter for SVG export.

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
`plugins/gwas/src/LinearManhattanDisplay/`, whose whole drawing is one mark over
the shared `pointMark`; this guide mirrors its shape.

## Files to create

`example-plugins/score-example/` is the finished plugin — a standalone package
CI installs from a packed tarball and asserts renders, so it stays buildable
against the published packages. It draws a box whose height is the feature's
score, which neither shared shape does, so it carries a shape of its own
(`scoreMark.ts` and `shaders/`); a display on `spanMark` or `pointMark` has
neither file:

<!-- EXAMPLE_PLUGIN_TREE START -->

```
src/
  index.ts                       the plugin class; installs the display, the RPC method and the feature panel
  LinearScoreDisplay/
    configSchema.ts              config slots (color, scoreColumn)
    findScoreHit.ts              the display's hit walk: hands every instance of each block to the mark's `hitNearest`
    index.ts                     registers the display type; the model and the component both load lazily
    model.ts                     MST model: rpcDataMap, renderState, fetchNeeded, startRenderingBackend, renderSvg
    renderSvg.tsx                SVG export: the mark list painted through renderDisplaySvg
    scoreMark.ts                 the `score` shape: score.slang's pass, its uniform write, its painter (also the SVG export) and its hit test
    scoreMarks.ts                ScoreRenderState, the mark list (one `score` mark over the RPC payload) and the backend type
    components/
      ScoreDisplayComponent.tsx  React: DisplayChrome wrapping the canvas; builds the backend from the mark list
    shaders/
      score.slang                the `score` shape's shader: one box per feature, compiled by gen:shaders
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
render lifecycle), `TrackHeightMixin`, and `StoredHoverMixin` for the hover the
component stores. You supply four things: a place to store fetched data
(`rpcDataMap`), a per-frame `renderState`, a `fetchNeeded` action, and a
`startRenderingBackend` action; the `renderSvg` action at the end is the export.

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/model.ts -->

````ts
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { types } from '@jbrowse/mobx-state-tree'
import { installUpload } from '@jbrowse/render-core/installUpload'

import type { ScoreRegionData } from '../ScoreRPC/rpcTypes.ts'
import type { LinearScoreDisplayConfigModel } from './configSchema.ts'
import type { ScoreHit } from './findScoreHit.ts'
import type { ScoreRenderState, ScoreRenderingBackend } from './scoreMarks.ts'
import type { Region } from '@jbrowse/core/util'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel LinearScoreDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * The worked-example score display: one value per feature, drawn as a box
 * along the genome. The developer guides walk through this model.
 *
 * #example
 * The display attaches to any `FeatureTrack`, so a track naming it in
 * `displays` gets it in place of the stock linear one:
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'genes_with_scores',
 *   name: 'Genes (scored)',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'BedTabixAdapter',
 *     bedGzLocation: { uri: 'https://example.com/genes.bed.gz' },
 *     index: { location: { uri: 'https://example.com/genes.bed.gz.tbi' } },
 *   },
 *   displays: [
 *     {
 *       type: 'LinearScoreDisplay',
 *       displayId: 'genes_with_scores-LinearScoreDisplay',
 *       scoreColumn: 'score',
 *     },
 *   ],
 * }
 * ```
 */
export function modelFactory(configSchema: LinearScoreDisplayConfigModel) {
  return types
    .compose(
      'LinearScoreDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      StoredHoverMixin<ScoreHit>((a, b) => a.start === b.start),
      types.model({
        type: types.literal('LinearScoreDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      // fetched data keyed by displayedRegionIndex: the foundation's per-region
      // store, narrowed to this display's payload. The render lifecycle
      // uploads/draws one region at a time from it
      get rpcDataMap(): ReadonlyMap<number, ScoreRegionData> {
        return self.regionPayloads as ReadonlyMap<number, ScoreRegionData>
      },
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
      // dimensions (required) plus whatever the marks read. The color is
      // resolved to the packed form here, once, so the uniform write and the
      // painter are handed the same number
      get renderState(): ScoreRenderState {
        return {
          canvasWidth: self.canvasWidthPx,
          canvasHeight: self.height,
          color: cssColorToABGR(getConf(self, 'color')),
        }
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
        return fetchEachRegion(self, needed, {
          // `ctx.callRpc`, never `rpcManager.call`: the context injects this
          // fetch's stop token and its status callback, and forgetting either
          // is silent — no cancellation for this display, or no progress. The
          // callback here is this region's own slot in the fan-out, so the N
          // parallel calls aggregate into one bar instead of overwriting each
          // other
          call: (region, ctx) =>
            ctx.callRpc('GetScoreData', {
              adapterConfig,
              region,
              ...self.rpcProps(),
            }),
          // what a region stores; the foundation commits it with the region's
          // span and fetch inputs as one record
          onResult: (_idx, result) => result,
        })
      },
      // called once by DisplayChrome when the backend is created, and again
      // after a context loss. One installer streams each region into the
      // backend and draws every frame from renderState; it is the only part of
      // the model that knows a backend exists, and it is the same whether that
      // backend is the GPU or the Canvas2D one.
      startRenderingBackend(backend: ScoreRenderingBackend) {
        installUpload(self, backend, {
          cells: () => self.rpcDataMap,
          render: b =>
            b.renderBlocks(
              self.renderBlocks,
              self.rpcDataMap,
              self.renderState,
            ),
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       * The SVG export, lazily loaded with the mark list it paints through.
       * Its own block: the export reads `self` as the slice `renderSvg.tsx`
       * declares, and MST does not type a block's own members onto its `self`
       */
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },
    }))
}

export type LinearScoreDisplayStateModel = ReturnType<typeof modelFactory>
export type LinearScoreDisplayModel = Instance<LinearScoreDisplayStateModel>
````

`renderBlocks` (the list of visible blocks with their pixel spans) comes from
`MultiRegionDisplayMixin`, so you don't compute it. The fetch chain
(`fetchNeeded`, `rpcProps`, cancellation, `regionTooLarge`) is documented in
full in [the data fetching pipeline](/docs/developer_guides/data_fetching).

## Step 4: The mark list

A **shape** owns geometry and picking: one `.slang` shader and its packer, one
uniform write, one Canvas2D painter (which is also the SVG export) and one hit
test, all reading the same channel arrays. A **mark** binds a shape to this
display through two lenses: `channels` names which of the payload's arrays feed
which of the shape's lanes, and `params` names which render-state values reach
its uniforms. That declaration is the whole of the renderer:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/scoreMarks.ts#marks -->

```ts
// Which of the payload's arrays feed which of the shape's lanes, and which
// render-state values reach its uniforms: two lenses, run once per block per
// frame. Everything that draws comes from the shape.
export const SCORE_MARKS = [
  defineMark({
    shape: scoreMark,
    channels: (d: ScoreRegionData) => ({
      startBp: d.starts,
      endBp: d.ends,
      score: d.scores,
      count: d.numFeatures,
    }),
    params: (s: ScoreRenderState) => ({ color: s.color }),
  }),
]
```

The example's `scoreMark` is its own, because a box grown from the bottom to a
value is neither of the shared shapes. Most displays are one of them, and name
it in place of `scoreMark` with nothing else to write:

- **`spanMark`** — a coloured rectangle from `x` to `x2` on the band of `row`:
  features laid into rows, MAF's alignment cells, anything that is a box on a
  row.
- **`pointMark`** — a glyph at `x` on a linear `domain` of `y`, widening to a
  bar where `x2 - x` is wider than the glyph: a scatter plot, Manhattan's
  points, any datum placed by a value.

Manhattan's whole drawing, over `pointMark`:

<!-- include: plugins/gwas/src/LinearManhattanDisplay/manhattanMarks.ts -->

```ts
import { defineMark, pointMark } from '@jbrowse/render-core/marks'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'

/**
 * What this display draws, as a declaration: one `point` mark, its channels
 * read straight off the RPC result's parallel arrays.
 *
 * The GPU pass and its packer, the Canvas2D painter (which is also the SVG
 * export) and the hit-test geometry all come from `pointMark`; what is written
 * here is only which of this display's arrays feed which lane, and which of its
 * render-state values reach the shape's uniforms.
 */
export const MANHATTAN_MARKS = [
  defineMark({
    shape: pointMark,
    channels: (d: ManhattanRpcResult) => ({
      x: d.positions,
      x2: d.ends,
      y: d.scores,
      color: d.colors,
      glyph: d.glyphs,
      count: d.numFeatures,
    }),
    params: (s: ManhattanRenderState) => ({
      domain: s.domainY,
      diameterPx: s.pointDiameterPx,
    }),
  }),
]
```

`ScoreRenderState` must include `canvasWidth` and `canvasHeight` (the
`FrameDimensions` the backend needs to size the backing store); add whatever
else the shape's `params` read. A shape takes packed colours and the display
resolves them, so the colour is stored here as the number the shader's uniform
takes, resolved once in the model:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/scoreMarks.ts#render-state -->

```ts
// Recomputed cheaply every frame without fetching: the canvas dimensions
// (required, to size the backing store) plus the one setting the drawing reads
export interface ScoreRenderState {
  canvasWidth: number
  canvasHeight: number
  // packed ABGR (`cssColorToABGR`), resolved once in the model so both backends
  // are handed the same number
  color: number
}
```

## Step 5: The React component

`DisplayChrome` wraps your canvas with shared status chrome (loading scrim,
error bar, "region too large" banner) and wires the rendering-backend factory
and WebGL/WebGPU context-loss recovery. You give it a factory and render the
`<canvas>` from the `canvasRef` it hands back. The factory is
`createMarkBackend` over the list — WebGPU, then WebGL2, then Canvas2D — and its
import is the one place the display reaches the GPU stack, which is why it sits
on the lazily loaded component and not on the model:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/components/ScoreDisplayComponent.tsx -->

```tsx
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import { observer } from 'mobx-react'

import { findScoreHit } from '../findScoreHit.ts'
import { SCORE_MARKS } from '../scoreMarks.ts'

import type { LinearScoreDisplayModel } from '../model.ts'

// The only import on the mark path that reaches the HAL. It lives here, on the
// lazily loaded component, and not in the model: a state model is eager, so
// naming the backend there would load the GPU stack at plugin install.
// createMarkBackend tries WebGPU, then WebGL2, then Canvas2D, and every backend
// walks the same mark list.
function createScoreBackend(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, SCORE_MARKS)
}

// DisplayChrome supplies the display's chrome (loading scrim, error bar,
// region-too-large banner) and WebGL/WebGPU context-loss recovery, and is the
// only place useRenderingBackend is called. Its render-prop hands back the
// canvasRef to attach to the <canvas>.
const ScoreDisplayComponent = observer(function ScoreDisplayComponent({
  model,
}: {
  model: LinearScoreDisplayModel
}) {
  const { hoveredFeature } = model
  return (
    <DisplayChrome
      model={model}
      factory={createScoreBackend}
      testid="score-display"
      style={{ width: '100%', height: model.height }}
      // measured against the chrome container, which the canvas fills, so the
      // pointer lands in canvas px with no offset
      onPointerPosition={state => {
        model.setHoveredFeature(
          state
            ? findScoreHit(
                state.x,
                state.y,
                model.renderBlocks,
                model.rpcDataMap,
                model.renderState,
              )
            : undefined,
        )
      }}
    >
      {({ canvasRef }) => (
        <>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
          {hoveredFeature ? (
            <div
              style={{
                position: 'absolute',
                left: hoveredFeature.x + 6,
                top: hoveredFeature.y - 6,
                pointerEvents: 'none',
                fontSize: 11,
                background: 'rgba(255,255,255,0.85)',
                padding: '0 3px',
              }}
            >
              {hoveredFeature.score.toFixed(2)}
            </div>
          ) : null}
        </>
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

import type PluginManager from '@jbrowse/core/PluginManager'

const ScoreDisplayComponent = lazy(
  () => import('./components/ScoreDisplayComponent.tsx'),
)

export default function LinearScoreDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearScoreDisplay',
      configSchema,
      // a thunk, so the model and everything it names load when a track first
      // shows this display or a session names it, not at plugin install
      stateModel: () =>
        import('./model.ts').then(m => m.modelFactory(configSchema)),
      displayName: 'Score display (example)',
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: ScoreDisplayComponent,
    })
  })
}
```

Both the model and the component load late. A state model is eager — anything
registered at plugin install loads everything it names by value — so the
`stateModel` thunk keeps the display's mixins and `installUpload` out of every
host's startup bundle until a track first shows the display or a session names
it.

Register the RPC method in the same plugin's `install()` with
`pluginManager.addRpcMethod(() => new GetScoreData(pluginManager))`, and see
[custom track and display types](/docs/developer_guides/creating_display) for
how displays attach to a track type.

## Hit-testing (clicks and hovers)

Where the ink is stays with the shape: its `hitNearest` measures the cursor
against the same rect its painter fills, and the shared shapes carry one. The
display's part is the walk — which blocks, which candidates — and what to do
with the answer:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/findScoreHit.ts#hit -->

```ts
// Where the ink is stays with the shape: `hitNearest` measures the cursor
// against the same rect `paintBlock` fills. This display has no spatial index,
// so it hands in every instance of every block under the cursor; one with a
// worker-built index would hand in what the index answered.
export function findScoreHit(
  xPx: number,
  yPx: number,
  blocks: RenderBlock[],
  regions: ReadonlyMap<number, ScoreRegionData>,
  state: ScoreRenderState,
): ScoreHit | undefined {
  let bestDistSq = HIT_RADIUS_PX ** 2
  let best: ScoreHit | undefined
  for (const block of blocks) {
    const data = regions.get(block.displayedRegionIndex)
    if (data) {
      const hit = MARK.hitNearest?.(
        data,
        block,
        state,
        xPx,
        yPx,
        everyInstance(data.numFeatures),
        bestDistSq,
      )
      if (hit) {
        bestDistSq = hit.distSq
        best = {
          start: data.starts[hit.index]!,
          end: data.ends[hit.index]!,
          score: data.scores[hit.index]!,
          x: hit.x,
          y: hit.y,
        }
      }
    }
  }
  return best
}
```

The component hands `DisplayChrome`'s `onPointerPosition` to it and stores the
hit through `StoredHoverMixin` (composed in Step 3), whose `hoveredFeature` the
body reads back. A display with many features per block builds a spatial index
(e.g.
[`Flatbush`](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/flatbush/index.ts))
from `rpcDataMap` in a cached view and hands `hitNearest` what the index
answered instead of every instance; `plugins/gwas`'s `findManhattanHit.ts` does
that.

## SVG export

The export comes with the mark: `paintMarkBlocks` runs each mark's painter
against the SVG context, and `renderDisplaySvg` owns the readiness gate and the
terminal states around it.

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/renderSvg.tsx#render-svg -->

```tsx
export async function renderSvg(
  model: ScoreSvgModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(model, opts, ScoreSvgBody)
}

// The same painter the Canvas2D backend runs, handed an SVG context. The
// export's width is the shell's, not the on-screen renderState's, which
// subtracts the track outline the export does not draw.
function ScoreSvgBody({
  model,
  height,
  canvasWidth,
  renderBlocks,
  opts,
}: LgvSvgBodyProps<ScoreSvgModel>) {
  const state = { ...model.renderState, canvasWidth, canvasHeight: height }
  return (
    <SvgClipRect
      id={`score-clip-${svgNodeId(model)}`}
      width={canvasWidth}
      height={height}
    >
      <PaintLayer
        width={canvasWidth}
        height={height}
        opts={opts}
        paint={ctx => {
          paintMarkBlocks(
            ctx,
            SCORE_MARKS,
            model.rpcDataMap,
            renderBlocks,
            state,
          )
        }}
      />
    </SvgClipRect>
  )
}
```

The model's `renderSvg` action loads it lazily.
[](/docs/developer_guides/svg_export) has the pipeline.

## A display with no shape at all

A drawing that is not instances of a shape — the reference sequence's letters —
skips the mark layer, writes a Canvas2D backend by hand and returns it through
`createCanvas2DBackend`, with no shader and no GPU ladder. `plugins/sequence` is
the one in-tree display still built that way:

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

## Writing your own shape

Everything above carries over unchanged — model, fetch chain, `renderState`, the
mark list, the component and the SVG export. What changes is the `shape` the
mark names: a `.slang`, a uniform write, a painter and a hit test of your own,
held to each other by a sweep test. See
[](/docs/developer_guides/creating_gpu_display).

## In-tree references

- `plugins/gwas/src/LinearManhattanDisplay/` - a real feature-plotting display
  (scored scatter) on the shared `pointMark`, plus an indexed hit test and LD
  coloring (this guide mirrors it)
- `plugins/variants/src/LinearMultiSampleVariantDisplay/` - a display that keeps
  a shape of its own (`cellMark.ts`) beside its shader
- `plugins/canvas/src/LinearBasicDisplay/` - the fullest reference: the generic
  feature display, five marks over one payload
- `plugins/sequence/src/LinearReferenceSequenceDisplay/` - the one Canvas2D-only
  display, with no shape

## See also

- [](/docs/developer_guides/creating_display)
- [](/docs/developer_guides/data_fetching)
- [](/docs/developer_guides/rpc_workers)
- [](/docs/developer_guides/svg_export)
- [](/docs/developer_guides/creating_gpu_display)
