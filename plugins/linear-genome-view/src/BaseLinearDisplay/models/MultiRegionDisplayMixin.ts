import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  measureText,
} from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'

export interface Region {
  refName: string
  start: number
  end: number
  assemblyName: string
}

/**
 * Mixin for displays that fetch data per-region.
 *
 * ## Fetch lifecycle contract
 *
 * Subclasses implement a `fetchRegions` function and a fetch autorun.
 * The autorun MUST guard on `self.isLoading` and `self.error` to prevent
 * re-fire loops (zombie Promise.all completions modifying loadedRegions
 * while a fetch is running, or repeated retries after an error).
 *
 * The fetch autorun pattern:
 *
 *     autorun(async () => {
 *       if (!view.initialized || self.isLoading || self.error) return
 *       // ... check which regions need fetching ...
 *       if (needed.length > 0) await fetchRegions(needed)
 *     }, { delay: 300 })
 *
 * The fetchRegions pattern:
 *
 *     1. Stop old token, create new token, capture generation
 *     2. Set renderingStopToken, isLoading=true, error=null
 *     3. try: await Promise.all(per-region fetches)
 *     4. catch: if not abort AND generation+token match → set error
 *     5. finally: if generation+token match → clear token, loading, status
 *
 * Staleness is detected by checking BOTH fetchGeneration (catches external
 * cancellation via clearAllRpcData) AND renderingStopToken (catches
 * self-supersession when a new fetchRegions call starts).
 *
 * ## Cancellation
 *
 * `clearAllRpcData()` is the canonical way to cancel in-flight fetches.
 * It stops the active token, resets isLoading, clears loadedRegions,
 * increments fetchGeneration, and calls clearDisplaySpecificData().
 * The old fetch's finally block will detect the generation mismatch
 * and skip cleanup (which clearAllRpcData already handled).
 *
 * Subclasses MUST implement `clearDisplaySpecificData()` to clear their
 * own rpcDataMap and any other display-specific state.
 */
export default function MultiRegionDisplayMixin() {
  return types
    .model('MultiRegionDisplayMixin', {})
    .volatile(() => ({
      loadedRegions: new Map<number, Region>(),
      isLoading: false,
      error: null as Error | null,
      renderingStopToken: undefined as string | undefined,
      fetchGeneration: 0,
    }))
    .views(self => ({
      get scalebarOverlapLeft() {
        const view = getContainingView(self) as LinearGenomeViewModel
        if (view.trackLabelsSetting === 'overlapping') {
          const track = getContainingTrack(self)
          return measureText(getConf(track, 'name'), 12.8) + 100
        }
        return 0
      },
    }))
    .actions(self => ({
      setLoading(loading: boolean) {
        self.isLoading = loading
      },

      setError(error: Error | null) {
        console.debug('[MultiRegionDisplayMixin] setError', error?.message ?? null)
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
        console.debug('[MultiRegionDisplayMixin] clearAllRpcData called', {
          hadToken: !!self.renderingStopToken,
          wasLoading: self.isLoading,
          hadError: !!self.error,
          fetchGeneration: self.fetchGeneration,
        })
        if (self.renderingStopToken) {
          stopStopToken(self.renderingStopToken)
          self.renderingStopToken = undefined
        }
        self.isLoading = false
        self.error = null
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
                  console.debug(
                    '[MultiRegionDisplayMixin] DisplayedRegionsChange → clearAllRpcData',
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

export type MultiRegionDisplayMixinType = ReturnType<
  typeof MultiRegionDisplayMixin
>
