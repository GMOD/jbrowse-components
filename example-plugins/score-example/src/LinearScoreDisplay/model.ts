// #exampleFile shared | MST model: rpcDataMap, renderState, fetchNeeded, startRenderingBackend, renderSvg
// #region imports
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
// #endregion

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
      // #region rpcProps
      // fetch inputs watched by SettingsInvalidate; any change refetches. Put
      // settings that change what the worker computes here; never scroll/zoom
      // (those change every frame) or the fetch results themselves.
      rpcProps() {
        return { scoreColumn: getConf(self, 'scoreColumn') }
      },
      // #endregion
    }))
    .views(self => ({
      // #region domain
      // the score range every loaded region's boxes are placed through: zero
      // up to the largest score any region shipped, read off the extremes the
      // encoder packed beside the channels, so a region arriving rescales
      // every box rather than only its own
      get domain(): [number, number] {
        let max = -Infinity
        for (const { yMax } of self.rpcDataMap.values()) {
          max = yMax > max ? yMax : max
        }
        return [0, max > 0 ? max : 1]
      },
      // #endregion
    }))
    .views(self => ({
      // #region renderState
      // recomputed cheaply every frame without fetching; carries the canvas
      // dimensions (required) plus whatever the marks read. The color is
      // resolved to the packed form here, once, so the uniform write and the
      // painter are handed the same number
      get renderState(): ScoreRenderState {
        return {
          canvasWidth: self.canvasWidthPx,
          canvasHeight: self.height,
          color: cssColorToABGR(getConf(self, 'color')),
          domainY: self.domain,
        }
      },
      // #endregion
    }))
    .actions(self => ({
      // #region fetchNeeded
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
      // #endregion
      // #region startRenderingBackend
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
      // #endregion
    }))
    .actions(self => ({
      // #region renderSvg
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
      // #endregion
    }))
}

export type LinearScoreDisplayStateModel = ReturnType<typeof modelFactory>
export type LinearScoreDisplayModel = Instance<LinearScoreDisplayStateModel>
