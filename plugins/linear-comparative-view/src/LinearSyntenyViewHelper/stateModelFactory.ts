import { GpuBackendLifecycleSlotMixin } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import {
  hideTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { getParent, types } from '@jbrowse/mobx-state-tree'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type {
  SyntenyBackend,
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from '../LinearSyntenyDisplay/syntenyBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Parent-view shape we read from. Duck-typed to avoid circular imports with
// the synteny view model.
interface ParentViewDuck {
  views: LinearGenomeViewModel[]
  maxOffScreenDrawPx: number
}

export function linearSyntenyViewHelperModelFactory(
  pluginManager: PluginManager,
) {
  return types
    .compose(
      'LinearSyntenyViewHelper',
      GpuBackendLifecycleSlotMixin(),
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
        height: 100,
        /**
         * #property
         */
        level: types.number,
        /**
         * #property
         */
        collapsed: false,
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       * Shared GPU backend owned by this level. All synteny displays within
       * the level upload their geometry to the same backend and render onto
       * one canvas.
       */
      gpuBackend: null as SyntenyBackend | null,
    }))
    .views(self => ({
      get effectiveHeight() {
        return self.collapsed ? 10 : self.height
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setHeight(n: number) {
        self.height = n
        return self.height
      },
      /**
       * #action
       */
      setCollapsed(collapsed: boolean) {
        self.collapsed = collapsed
      },
      /**
       * #action
       */
      toggleCollapsed() {
        self.collapsed = !self.collapsed
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
        toggleTrackGeneric(self, trackId)
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
          if (display.instanceData) {
            m.set(display.displayKey, display.instanceData)
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
          maxOffScreenPx: self.parentView.maxOffScreenDrawPx,
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
    .actions(self => {
      const baseStop = self.stopGpuBackendLifecycle
      return {
        /**
         * #action
         */
        startGpuBackendLifecycle(backend: SyntenyBackend) {
          self.gpuBackend = backend
          self.startMultiRegionGpuLifecycle<SyntenyBackend, SyntenyRenderState>(
            {
              backend,
              uploads: [
                {
                  getData: () => self.geometryByDisplayKey,
                  upload: (b, key, data: SyntenyInstanceData) => {
                    b.uploadGeometry(key, data)
                  },
                  deleteOne: (b, key) => {
                    b.deleteGeometry(key)
                  },
                },
              ],
              renderBlocks: () => [],
              renderState: () => self.syntenyRenderState,
              render: (b, _blocks, state) => {
                b.resize(self.parentView.views[0]!.width, self.effectiveHeight)
                b.render(state)
              },
            },
          )
        },
        stopGpuBackendLifecycle() {
          baseStop()
          self.gpuBackend = null
        },
      }
    })
}

export type LinearSyntenyViewHelperStateModel = ReturnType<
  typeof linearSyntenyViewHelperModelFactory
>
export type LinearSyntenyViewHelperModel =
  Instance<LinearSyntenyViewHelperStateModel>
