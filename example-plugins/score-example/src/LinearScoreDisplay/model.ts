// #exampleFile shared | MST model: rpcDataMap, renderState, fetchNeeded, startRenderingBackend
// #region imports
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView } from '@jbrowse/core/util'
import MultiRegionDisplayMixin, {
  fetchEachRegion,
} from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { types } from '@jbrowse/mobx-state-tree'
import { installPerRegionLifecycle } from '@jbrowse/render-core/installPerRegionLifecycle'
import { observable } from 'mobx'
// #endregion

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
      // #region rpcProps
      // fetch inputs watched by SettingsInvalidate; any change refetches. Put
      // settings that change what the worker computes here; never scroll/zoom
      // (those change every frame) or the fetch results themselves.
      rpcProps() {
        return { scoreColumn: getConf(self, 'scoreColumn') }
      },
      // #endregion
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
          onResult: (idx, result) => {
            self.setRpcData(idx, result)
          },
        })
      },
      // #endregion
      // #region startRenderingBackend
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
      // #endregion
    }))
}

export type LinearScoreDisplayStateModel = ReturnType<typeof modelFactory>
export type LinearScoreDisplayModel = Instance<LinearScoreDisplayStateModel>
