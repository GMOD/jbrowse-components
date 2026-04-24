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
        const { level, adapterConfig } = self
        if (level + 1 >= view.views.length) {
          return
        }

        // Snapshot every RPC input synchronously. All reads here track,
        // but `delay: 500` on this autorun debounces pan/zoom firehoses
        // into one fire per ~500ms of quiet.
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
        const regions = view.views[level]!.staticBlocks.contentBlocks
        const drawCIGAR = view.drawCIGAR
        const drawCIGARMatchesOnly = view.drawCIGARMatchesOnly
        const drawLocationMarkers = view.drawLocationMarkers
        const chainMerge = view.chainMerge

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
                if (isAlive(self)) {
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
          if (!isAbortException(e) && isAlive(self)) {
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

export { type SyntenyRpcResult } from '../LinearSyntenyRPC/executeSyntenyFeaturesAndPositions.ts'
