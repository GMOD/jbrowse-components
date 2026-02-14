import { getContainingView } from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'

export interface Region {
  refName: string
  start: number
  end: number
  assemblyName?: string
}

/**
 * Mixin for WebGL displays that fetch data per-region.
 *
 * Subclasses MUST implement `clearDisplaySpecificData()` to clear their own
 * rpcDataMap and any other display-specific state. The mixin's
 * `clearAllRpcData()` calls it automatically — subclasses should never need
 * to override `clearAllRpcData` itself.
 */
export default function MultiRegionWebGLDisplayMixin() {
  return types
    .model('MultiRegionWebGLDisplayMixin', {})
    .volatile(() => ({
      loadedRegions: new Map<number, Region>(),
      isLoading: false,
      error: null as Error | null,
      renderingStopToken: undefined as string | undefined,
      fetchGeneration: 0,
    }))
    .actions(self => ({
      setLoading(loading: boolean) {
        self.isLoading = loading
      },

      setError(error: Error | null) {
        self.error = error
      },

      setRenderingStopToken(token: string | undefined) {
        self.renderingStopToken = token
      },

      setLoadedRegionForRegion(regionNumber: number, region: Region) {
        const next = new Map(self.loadedRegions)
        next.set(regionNumber, region)
        self.loadedRegions = next
      },

      clearDisplaySpecificData() {
        // no-op base — subclasses override to clear rpcDataMap etc.
      },
    }))
    .actions(self => ({
      clearAllRpcData() {
        console.log(
          '[AlignmentsDebug] clearAllRpcData',
          {
            hadStopToken: !!self.renderingStopToken,
            loadedRegionsSize: self.loadedRegions.size,
            fetchGeneration: self.fetchGeneration,
          },
          new Error('stack').stack,
        )
        if (self.renderingStopToken) {
          stopStopToken(self.renderingStopToken)
          self.renderingStopToken = undefined
        }
        self.loadedRegions = new Map()
        self.fetchGeneration++
        self.clearDisplaySpecificData()
      },
    }))
    .actions(self => {
      let prevDisplayedRegionsStr = ''
      return {
        afterAttach() {
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LinearGenomeViewModel
                if (!view.initialized) {
                  return
                }
                const regionStr = JSON.stringify(
                  view.displayedRegions.map(r => ({
                    refName: r.refName,
                    start: r.start,
                    end: r.end,
                  })),
                )
                if (
                  prevDisplayedRegionsStr !== '' &&
                  regionStr !== prevDisplayedRegionsStr
                ) {
                  console.log(
                    '[AlignmentsDebug] DisplayedRegionsChange: clearing data',
                  )
                  self.clearAllRpcData()
                }
                prevDisplayedRegionsStr = regionStr
              },
              { name: 'DisplayedRegionsChange' },
            ),
          )
        },
      }
    })
}

export type MultiRegionWebGLDisplayMixinType = ReturnType<
  typeof MultiRegionWebGLDisplayMixin
>
