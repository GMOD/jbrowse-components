import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { parseSyntenyRpcResult } from './parseSyntenyRpcResult.ts'

import type { LinearSyntenyDisplayModel } from './model.ts'
import type {
  SyntenyInstanceData,
  SyntenyRpcResult,
} from './parseSyntenyRpcResult.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'

type LSV = LinearSyntenyViewModel

export function doAfterAttach(self: LinearSyntenyDisplayModel) {
  let lastInstanceData: SyntenyInstanceData | undefined
  let lastRenderer: unknown = null
  let currentStopToken: StopToken | undefined

  addDisposer(
    self,
    autorun(
      function syntenyDrawAutorun() {
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

        const { alpha, featPositions, level, minAlignmentLength } = self
        const webglInstanceData = self.webglInstanceData
        const height = self.height
        const width = view.width
        const isScrolling =
          self.isScrolling ||
          view.views.some(
            v => (v as unknown as { isScrolling?: boolean }).isScrolling,
          )

        if (!self.webglRenderer || !self.webglInitialized) {
          return
        }

        if (self.webglRenderer !== lastRenderer) {
          lastInstanceData = undefined
          lastRenderer = self.webglRenderer
        }

        self.webglRenderer.resize(width, height)

        if (webglInstanceData && webglInstanceData !== lastInstanceData) {
          lastInstanceData = webglInstanceData
          self.webglRenderer.uploadGeometry(webglInstanceData, view.drawCurves)
        }

        if (!featPositions.length) {
          return
        }

        const o0 = view.views[level]!.offsetPx
        const o1 = view.views[level + 1]!.offsetPx
        const bpPerPx0 = view.views[level]!.bpPerPx
        const bpPerPx1 = view.views[level + 1]!.bpPerPx

        const maxOffScreenPx = view.maxOffScreenDrawPx

        self.webglRenderer.render(
          o0,
          o1,
          height,
          bpPerPx0,
          bpPerPx1,
          false,
          maxOffScreenPx,
          minAlignmentLength,
          alpha,
          isScrolling,
        )
      },
      {
        name: 'SyntenyDraw',
      },
    ),
  )

  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  addDisposer(
    self,
    autorun(
      function syntenyFetchAutorun() {
        if (self.isMinimized) {
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
        JSON.stringify(view.views.map(v => v.displayedRegions))
        view.views.map(v => v.bpPerPx)
        view.views.map(v => v.staticBlocks.contentBlocks.map(b => b.key))

        // Track rendering settings so RPC re-fires when they change
        const colorBy = self.colorBy
        const drawCurves = view.drawCurves
        const drawCIGAR = view.drawCIGAR
        const drawCIGARMatchesOnly = view.drawCIGARMatchesOnly
        const drawLocationMarkers = view.drawLocationMarkers

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

            const result = (await rpcManager.call(
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
              },
            )) as SyntenyRpcResult

            if (thisStopToken !== currentStopToken || !isAlive(self)) {
              return
            }

            const featPositions = parseSyntenyRpcResult(result)
            self.setFeatPositions(featPositions)
            self.setWebglInstanceData(result.instanceData)

            console.log('[WebGL Synteny] RPC result processed:', {
              featPositionsCount: featPositions.length,
              instanceDataCount: result.instanceData?.instanceCount,
            })
          } catch (e) {
            if (!isAbortException(e)) {
              if (isAlive(self)) {
                console.error(e)
                self.setError(e)
              }
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
