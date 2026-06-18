import {
  getContainingView,
  getSession,
  isAbortException,
  statusMessageText,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { detectDisplayAssembliesSwapped } from '@jbrowse/synteny-core'
import { autorun, untracked } from 'mobx'

import type { LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

// SYNC: stop-token autorun fetch skeleton mirrors afterAttach.ts in dotplot-view
export function doAfterAttach(self: LinearSyntenyDisplayModel) {
  let currentStopToken: StopToken | undefined

  addDisposer(
    self,
    autorun(
      async function syntenyFetchAutorun() {
        if (self.isMinimized) {
          return
        }
        const view = getContainingView(self) as LinearSyntenyViewModel
        if (
          !view.initialized ||
          !view.views.every(a => a.displayedRegions.length > 0 && a.initialized)
        ) {
          return
        }
        const level = self.level
        if (level + 1 >= view.views.length) {
          return
        }

        // Tracked deps that SHOULD trigger refetch when changed:
        //   - displayedRegions (per view) — region set drives cumBp output
        //   - adapterConfig and CIGAR drawing options
        //   - a log2 bucket of bpPerPx (per view) — the worker's viewport
        //     cull is sized in px at fetch-time, so zooming out by ~2x
        //     leaves features missing beyond the previous cull window.
        //     Bucketing on log2 avoids refetching on smooth scroll-zoom
        //     bursts within the same half-decade.
        // Not tracked: raw `bpPerPx`, `offsetPx`, `width`,
        // `minimumBlockWidth`. Scroll moves are
        // absorbed by the worker's 50% px buffer.
        for (const v of view.views) {
          void v.displayedRegions
          void Math.floor(Math.log2(Math.max(v.bpPerPx, 1)))
        }
        const adapterConfig = self.adapterConfig
        const {
          drawCIGAR,
          drawCIGARMatchesOnly,
          drawLocationMarkers,
          lodMode,
        } = view
        // Untracked reads: values for the worker. Reading these inside
        // `untracked` prevents them from registering as autorun deps, so
        // scroll/zoom changes don't refire the fetch. The worker still
        // sees the *current* offsetPx/bpPerPx for the cull at fetch time.
        const viewSnaps = untracked(() =>
          view.views.map(v => ({
            bpPerPx: v.bpPerPx,
            offsetPx: v.offsetPx,
            displayedRegions: v.displayedRegions,
            minimumBlockWidth: v.minimumBlockWidth,
            width: v.width,
          })),
        )

        if (currentStopToken) {
          stopStopToken(currentStopToken)
        }
        const thisStopToken = createStopToken()
        currentStopToken = thisStopToken
        // Clear any prior error as the new fetch begins, so a stale banner
        // never lingers over freshly-loaded data (mirrors dotplot setLoading).
        self.setError(undefined)

        try {
          const sessionId = getRpcSessionId(self)
          const result = await getSession(self).rpcManager.call(
            sessionId,
            'SyntenyGetFeaturesAndPositions',
            {
              adapterConfig,
              viewSnaps,
              level,
              sessionId,
              stopToken: thisStopToken,
              drawCIGAR,
              drawCIGARMatchesOnly,
              drawLocationMarkers,
              lodMode,
              statusCallback: (msg: RpcStatus) => {
                if (thisStopToken === currentStopToken && isAlive(self)) {
                  self.setStatusMessage(statusMessageText(msg))
                }
              },
            },
          )
          if (thisStopToken !== currentStopToken || !isAlive(self)) {
            return
          }
          const { instanceData, ...featureData } = result
          self.setRpcData(featureData, instanceData)
        } catch (e) {
          if (
            thisStopToken === currentStopToken &&
            !isAbortException(e) &&
            isAlive(self)
          ) {
            console.error(e)
            self.setError(e)
          }
        } finally {
          if (isAlive(self) && thisStopToken === currentStopToken) {
            self.setStatusMessage(undefined)
          }
        }
      },
      { name: 'SyntenyFetch', delay: 500 },
    ),
  )

  // One-shot at view load: compare the adapter's reported refNames per row
  // against each assembly's full refNames to flag a reversed row order. Runs
  // off the per-render fetch path so it never re-fires (or misfires) on zoom.
  addDisposer(
    self,
    autorun(
      async function syntenyAssemblySwapCheck() {
        const view = getContainingView(self) as LinearSyntenyViewModel
        const level = self.level
        if (!view.initialized || level + 1 >= view.views.length) {
          return
        }
        const swapped = await detectDisplayAssembliesSwapped(
          self,
          view.views[level]!.assemblyNames[0],
          view.views[level + 1]!.assemblyNames[0],
        )
        if (isAlive(self)) {
          self.setAssembliesSwapped(swapped)
        }
      },
      { name: 'SyntenyAssemblySwapCheck' },
    ),
  )

  addDisposer(self, () => {
    if (currentStopToken) {
      stopStopToken(currentStopToken)
    }
  })
}
