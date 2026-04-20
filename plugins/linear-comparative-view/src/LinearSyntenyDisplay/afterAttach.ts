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

type LSV = LinearSyntenyViewModel

export function doAfterAttach(self: LinearSyntenyDisplayModel) {
  let currentStopToken: StopToken | undefined
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  addDisposer(
    self,
    autorun(
      function syntenyFetchAutorun() {
        if (self.isMinimized || self.isLevelCollapsed) {
          return
        }
        const view = getContainingView(self) as LSV
        if (
          !view.initialized ||
          !view.views.every(a => a.displayedRegions.length > 0 && a.initialized)
        ) {
          return
        }

        // access observables to track them (issue #3456)
        for (const v of view.views) {
          void v.displayedRegions
          void v.bpPerPx
          for (const b of v.staticBlocks.contentBlocks) {
            void b.key
          }
        }

        const colorBy = self.colorBy
        const drawCurves = view.drawCurves
        const drawCIGAR = view.drawCIGAR
        const drawCIGARMatchesOnly = view.drawCIGARMatchesOnly
        const drawLocationMarkers = view.drawLocationMarkers
        const chainMerge = view.chainMerge

        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
        if (currentStopToken) {
          stopStopToken(currentStopToken)
        }

        const thisStopToken = createStopToken()
        currentStopToken = thisStopToken

        debounceTimer = setTimeout(async () => {
          try {
            const { level, adapterConfig } = self
            const { rpcManager } = getSession(self)
            const view = getContainingView(self) as LSV
            if (
              !view.initialized ||
              level + 1 >= view.views.length ||
              !view.views.every(
                a => a.displayedRegions.length > 0 && a.initialized,
              )
            ) {
              return
            }
            const sessionId = getRpcSessionId(self)

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

            const result = await rpcManager.call(
              sessionId,
              'SyntenyGetFeaturesAndPositions',
              {
                adapterConfig,
                regions,
                viewSnaps,
                level,
                sessionId,
                stopToken: thisStopToken,
                colorBy,
                drawCurves,
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
            self.setFeatureData(featureData)
            self.setInstanceData(instanceData)
          } catch (e) {
            if (!isAbortException(e)) {
              if (isAlive(self)) {
                console.error(e)
                self.setError(e)
              }
            }
          } finally {
            if (isAlive(self) && thisStopToken === currentStopToken) {
              self.setStatusMessage(undefined)
            }
          }
        }, 300)
      },
      { name: 'SyntenyFetch' },
    ),
  )
  addDisposer(self, () => {
    clearTimeout(debounceTimer)
    if (currentStopToken) {
      stopStopToken(currentStopToken)
    }
  })
}

export { type SyntenyRpcResult } from '../LinearSyntenyRPC/executeSyntenyFeaturesAndPositions.ts'
