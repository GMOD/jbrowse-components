import {
  hideTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { getParent, types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type {
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
      get parentView() {
        return getParent<ParentViewDuck>(self, 2)
      },
      get assemblyNames(): string[] {
        const p = this.parentView
        if (self.level + 1 >= p.views.length) {
          return []
        }
        return [
          p.views[self.level]!.assemblyNames[0] ?? '',
          p.views[self.level + 1]!.assemblyNames[0] ?? '',
        ]
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
       */
      get numFeats() {
        let n = 0
        for (const display of this.linearSyntenyDisplays) {
          n += display.numFeats
        }
        return n
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
          (!this.parentView.autoDiagonalizeRequested ||
            this.parentView.autoDiagonalizeComplete)
        )
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
        // upstream deps are unchanged. Track what we last uploaded per
        // key so an upload-autorun re-fire from one display doesn't push
        // identical bytes back to the GPU for the others.
        const lastUploaded = new Map<number, SyntenyInstanceData>()
        let prevUploadRenderingBackend: SyntenyRenderingBackend | undefined
        self.attachRenderingBackend<SyntenyRenderingBackend>(backend, {
          upload: b => {
            // When the backend instance changes (e.g. canvas remounted after
            // context loss or Suspense), the new backend has no geometry —
            // clear the cache to force a full re-upload.
            if (b !== prevUploadRenderingBackend) {
              lastUploaded.clear()
              prevUploadRenderingBackend = b
            }
            const currentKeys = new Set<number>()
            for (const [key, data] of self.geometryByDisplayKey) {
              currentKeys.add(key)
              if (lastUploaded.get(key) === data) {
                continue
              }
              b.uploadGeometry(key, data)
              lastUploaded.set(key, data)
            }
            for (const key of lastUploaded.keys()) {
              if (!currentKeys.has(key)) {
                b.deleteGeometry(key)
                lastUploaded.delete(key)
              }
            }
          },
          render: b => {
            const state = self.syntenyRenderState
            if (!state) {
              return false
            }
            // the parent's own width, not views[0]'s: the same number one hop
            // closer (the view pushes it down to every row) and no assertion on
            // a row that may not exist yet
            b.resize(self.parentView.width, self.height)
            return b.render(state)
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
