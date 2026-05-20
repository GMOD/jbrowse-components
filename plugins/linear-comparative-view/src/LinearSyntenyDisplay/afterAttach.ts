import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import type { LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
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
        // Tracking `v.bpPerPx`, `v.offsetPx`, `v.width`,
        // `v.interRegionPaddingWidth`, or `v.minimumBlockWidth` directly
        // here would refire the autorun on every scroll frame even though
        // the worker output is in absolute genomic coords and does not
        // depend on those values (the worker uses them only for viewport
        // culling, with a 50% buffer that absorbs typical scroll moves).
        // See agent-docs/ARCHITECTURE.md "Coordinate convention".
        for (const v of view.views) {
          void v.displayedRegions
        }
        const adapterConfig = self.adapterConfig
        const { drawCIGAR, drawCIGARMatchesOnly, drawLocationMarkers } = view
        // Untracked reads: values for the worker. Reading these inside
        // `untracked` prevents them from registering as autorun deps, so
        // scroll/zoom changes don't refire the fetch. The worker still
        // sees the *current* offsetPx/bpPerPx for the cull at fetch time.
        const viewSnaps = untracked(() =>
          view.views.map(v => ({
            bpPerPx: v.bpPerPx,
            offsetPx: v.offsetPx,
            displayedRegions: v.displayedRegions,
            interRegionPaddingWidth: v.interRegionPaddingWidth,
            minimumBlockWidth: v.minimumBlockWidth,
            width: v.width,
          })),
        )

        if (currentStopToken) {
          stopStopToken(currentStopToken)
        }
        const thisStopToken = createStopToken()
        currentStopToken = thisStopToken

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
              statusCallback: (msg: string) => {
                if (thisStopToken === currentStopToken && isAlive(self)) {
                  self.setStatusMessage(msg)
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
  addDisposer(self, () => {
    if (currentStopToken) {
      stopStopToken(currentStopToken)
    }
  })
}
