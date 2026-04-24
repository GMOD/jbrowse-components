import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

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

        // `chainMergeLodBucket` is a value-memoized getter — reading it
        // tracks bpPerPx only when it actually changes the output bucket.
        void self.chainMergeLodBucket
        const adapterConfig = self.adapterConfig
        const {
          drawCIGAR,
          drawCIGARMatchesOnly,
          drawLocationMarkers,
          chainMerge,
        } = view
        const viewSnaps = view.views.map(v => ({
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
