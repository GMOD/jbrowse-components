import { getContainingView } from '@jbrowse/core/util'
import {
  hideTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { createKeyedUploadSync } from '@jbrowse/render-core/keyedUploadSync'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type {
  SyntenyPickResult,
  SyntenyRenderState,
  SyntenyRenderingBackend,
  SyntenyTrackRenderParams,
} from '../LinearSyntenyDisplay/syntenyRenderingBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { ParentViewDuck } from './parentViewDuck.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel LinearSyntenyViewHelper
 * Holds one level of a linear synteny comparison: its track list, height and
 * level index, composed with the shared rendering-lifecycle state.
 *
 * Nested in LinearComparativeView.levels, never in session.views: it is a track
 * container, not a view, and satisfies core's `TrackContainer` so the
 * track-selector and add-track widgets can write into it via the parent view's
 * `trackContainerFor`. The `LinearSyntenyViewHelper` name and `type` literal are
 * kept only because saved sessions persist them.
 */
export function linearSyntenyViewHelperModelFactory(
  pluginManager: PluginManager,
) {
  return types
    .compose(
      'LinearSyntenyViewHelper',
      RenderLifecycleMixin(),
      types.model({
        /**
         * #property
         */
        id: ElementId,
        /**
         * #property
         */
        type: 'LinearSyntenyViewHelper',
        /**
         * #property
         */
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),
        /**
         * #property
         */
        height: types.stripDefault(types.number, 100),
        /**
         * #property
         */
        level: types.number,
      }),
    )
    .views(self => ({
      /**
       * #getter
       * Typed accessor for the slot-mixin-owned `currentRenderingBackend`. All
       * synteny displays within the level upload their geometry to the same
       * backend and render onto one canvas.
       */
      get gpuRenderingBackend(): SyntenyRenderingBackend | undefined {
        return self.currentRenderingBackend as
          | SyntenyRenderingBackend
          | undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setHeight(n: number) {
        self.height = n
      },
      /**
       * #action
       */
      showTrack(trackId: string, initialSnapshot = {}) {
        return showTrackGeneric(self, trackId, initialSnapshot)
      },
      /**
       * #action
       */
      hideTrack(trackId: string) {
        return hideTrackGeneric(self, trackId)
      },
      /**
       * #action
       */
      toggleTrack(trackId: string) {
        return toggleTrackGeneric(self, trackId)
      },
    }))
    .views(self => ({
      // The LinearSyntenyView this level belongs to. getContainingView rather
      // than a hop count: a level has no width/setWidth, so isViewModel walks
      // past it to the real view.
      get parentView() {
        return getContainingView(self) as unknown as ParentViewDuck
      },
      // The pair of genome rows this level draws between, or [] for a trailing
      // level that has no row below it yet.
      get assemblyNames(): string[] {
        const { views } = this.parentView
        const v0 = views[self.level]
        const v1 = views[self.level + 1]
        return v0 && v1
          ? [v0.assemblyNames[0] ?? '', v1.assemblyNames[0] ?? '']
          : []
      },
      /**
       * #getter
       * All synteny displays under this level's tracks.
       */
      get linearSyntenyDisplays() {
        const out: LinearSyntenyDisplayModel[] = []
        for (const track of self.tracks) {
          for (const display of track.displays) {
            if (display.type === 'LinearSyntenyDisplay') {
              out.push(display as LinearSyntenyDisplayModel)
            }
          }
        }
        return out
      },
      /**
       * #getter
       * Canvas has painted and no display is still fetching, so what's on
       * screen is the final settled content. Drives the `synteny_canvas_done`
       * test-id, which screenshot capture and the browser-test suites wait on
       * before snapshotting — so it must mean "done", not just "first paint".
       */
      get settled() {
        return (
          self.canvasDrawn &&
          this.linearSyntenyDisplays.every(
            // dataCurrent guards the debounce gap: after a region/zoom change
            // the held ribbons are stale yet no fetch is in flight for ~500ms,
            // so loading/refetching alone would report done on the wrong data
            d => !d.loading && !d.refetching && d.dataCurrent,
          ) &&
          // if an init autoDiagonalize was requested, the view isn't "done"
          // until that reorder has actually completed — otherwise a
          // skipped/errored reorder would settle on the undiagonalized view
          this.parentView.diagonalizeSettled
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Point the whole level's hover state at one pick hit: the display whose
       * geometry was hit takes the instance index, every other display clears.
       * `undefined` (a miss) therefore clears the level. An action rather than a
       * loop in the canvas component so the N writes land in one MobX batch, and
       * so the canvas never has to resolve the pick key to a display model.
       */
      setHoveredFeature(hit: SyntenyPickResult | undefined) {
        for (const display of self.linearSyntenyDisplays) {
          display.setHoveredFeatureIdx(
            display.displayKey === hit?.key ? hit.featureIndex : -1,
          )
        }
      },
      /**
       * #action
       * Clicked-state twin of `setHoveredFeature`.
       */
      setClickedFeature(hit: SyntenyPickResult | undefined) {
        for (const display of self.linearSyntenyDisplays) {
          display.setClickedFeatureIdx(
            display.displayKey === hit?.key ? hit.featureIndex : -1,
          )
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Per-display GPU geometry keyed by displayKey. The upload autorun
       * diffs this map — new entries upload, vanished entries evict.
       */
      get geometryByDisplayKey() {
        const m = new Map<number, SyntenyInstanceData>()
        for (const display of self.linearSyntenyDisplays) {
          // Read renderInstanceData (main-thread-recolored) not instanceData,
          // so colorBy changes re-upload without an RPC refetch.
          const data = display.renderInstanceData
          if (data) {
            m.set(display.displayKey, data)
          }
        }
        return m
      },
      /**
       * #getter
       * Aggregated per-frame render state. Every display in the level draws
       * starting at yTop=0 since each level owns its own canvas.
       */
      get syntenyRenderState(): SyntenyRenderState | undefined {
        const perTrack = new Map<number, SyntenyTrackRenderParams>()
        for (const display of self.linearSyntenyDisplays) {
          const params = display.renderParams
          if (params) {
            perTrack.set(display.displayKey, params)
          }
        }
        if (perTrack.size === 0) {
          return undefined
        }
        return {
          overdrawPx: self.parentView.overdrawPx,
          perTrack,
        }
      },
      /**
       * #getter
       * Reverse lookup key → display, used to dispatch pick results.
       */
      get displaysByKey() {
        const m = new Map<number, LinearSyntenyDisplayModel>()
        for (const display of self.linearSyntenyDisplays) {
          m.set(display.displayKey, display)
        }
        return m
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      startRenderingBackend(backend: SyntenyRenderingBackend) {
        // renderInstanceData is MST-cached; its reference is stable while
        // upstream deps are unchanged, so the identity diff keeps an
        // upload-autorun re-fire from one display off the other displays'
        // buffers.
        const syncUpload = createKeyedUploadSync<
          SyntenyInstanceData,
          SyntenyRenderingBackend
        >()
        self.attachRenderingBackend<SyntenyRenderingBackend>(backend, {
          upload: b => {
            syncUpload(b, self.geometryByDisplayKey)
          },
          render: b => {
            // the parent's own width, not views[0]'s: the same number one hop
            // closer (the view pushes it down to every row) and no assertion on
            // a row that may not exist yet
            b.resize(self.parentView.width, self.height)
            const state = self.syntenyRenderState
            if (state) {
              return b.render(state)
            }
            // No display can paint this band: the row pair has no synteny track
            // (a legal launch — the rows just stack with no ribbons), the one it
            // had was hidden, or every one of them is minimized. Clearing is
            // what drops a hidden track's ribbons off the Canvas2D backend,
            // which keeps its last frame otherwise; reporting `true` is what
            // lets `canvasDrawn` — and so `settled`, the synteny_canvas_done
            // testid — resolve on a level that has nothing to show. Waiting on
            // data is NOT this branch: a display with no data yet still
            // contributes renderParams, and the backends answer that with
            // `false` while their geometry cache is empty.
            b.clear()
            return true
          },
        })
      },
    }))
}

export type LinearSyntenyViewHelperStateModel = ReturnType<
  typeof linearSyntenyViewHelperModelFactory
>
export type LinearSyntenyViewHelperModel =
  Instance<LinearSyntenyViewHelperStateModel>
