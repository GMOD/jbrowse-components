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

export function doAfterAttach(self: LinearSyntenyDisplayModel) {
  let currentStopToken: StopToken | undefined

  addDisposer(
    self,
    autorun(
      async function syntenyFetchAutorun() {
        if (self.isMinimized || self.isLevelCollapsed) {
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

        // Tracked reads — mobx re-fires this autorun only when one of
        // these changes. `displayedRegions` is a frozen type so a shallow
        // read of the reference is enough — it's replaced atomically on
        // nav. Deliberately absent: bpPerPx (read only through
        // `chainMergeLodBucket`, which value-memoizes), offsetPx, width,
        // staticBlocks. Those are viewport concerns handled by GPU
        // reproject uniforms — they must not invalidate the fetch.
        const v0 = view.views[level]!
        const v1 = view.views[level + 1]!
        void v0.displayedRegions
        void v1.displayedRegions
        const drawCIGAR = view.drawCIGAR
        const drawCIGARMatchesOnly = view.drawCIGARMatchesOnly
        const drawLocationMarkers = view.drawLocationMarkers
        const chainMerge = view.chainMerge
        void self.chainMergeLodBucket

        // Everything else is untracked — the worker still needs per-view
        // bpPerPx/offsetPx/etc in Phase 1 for pixel-space arithmetic, but
        // those reads must not retrigger the fetch.
        const { adapterConfig, regions, viewSnaps } = untracked(() => ({
          adapterConfig: self.adapterConfig,
          regions: v0.displayedRegions,
          viewSnaps: view.views.map(v => ({
            bpPerPx: v.bpPerPx,
            offsetPx: v.offsetPx,
            displayedRegions: v.displayedRegions,
            staticBlocks: {
              contentBlocks: v.staticBlocks.contentBlocks,
              blocks: v.staticBlocks.blocks,
            },
            interRegionPaddingWidth: v.interRegionPaddingWidth,
            minimumBlockWidth: v.minimumBlockWidth,
            width: v.width,
          })),
        }))

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
              regions,
              viewSnaps,
              level,
              sessionId,
              stopToken: thisStopToken,
              drawCIGAR,
              drawCIGARMatchesOnly,
              drawLocationMarkers,
              chainMerge,
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
