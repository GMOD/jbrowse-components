import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { createColorFunction } from './drawSyntenyWebGL.ts'
import { parseSyntenyRpcResult } from './parseSyntenyRpcResult.ts'

import type { FeatPos, LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { SyntenyRpcResult } from './parseSyntenyRpcResult.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'

type LSV = LinearSyntenyViewModel

export function doAfterAttach(self: LinearSyntenyDisplayModel) {
  let lastGeometryKey = ''
  let lastFeatPositions: FeatPos[] = []
  let lastRenderer: unknown = null
  // bpPerPx values at which featPositions were computed (by the RPC).
  // buildGeometry uses these as the "reference" so the shader's scale
  // compensation (geometryBpPerPx / currentBpPerPx) is correct.
  let featPositionsBpPerPxs: number[] = []
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
          !view.views.every(
            a => a.displayedRegions.length > 0 && a.initialized,
          )
        ) {
          return
        }

        const { alpha, colorBy, featPositions, level, minAlignmentLength } =
          self
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

        // Reset geometry key when renderer changes (e.g. React StrictMode
        // re-creates the renderer)
        if (self.webglRenderer !== lastRenderer) {
          lastGeometryKey = ''
          lastRenderer = self.webglRenderer
        }

        const geometryKey = `${featPositions.length}-${colorBy}-${view.drawCurves}-${view.drawCIGAR}-${view.drawCIGARMatchesOnly}-${view.drawLocationMarkers}`

        // Always resize in case dimensions changed
        self.webglRenderer.resize(width, height)

        if (
          geometryKey !== lastGeometryKey ||
          featPositions !== lastFeatPositions
        ) {
          lastGeometryKey = geometryKey
          lastFeatPositions = featPositions
          const colorFn = createColorFunction(colorBy)
          self.webglRenderer.buildGeometry(
            featPositions,
            level,
            colorBy,
            colorFn,
            view.drawCurves,
            view.drawCIGAR,
            view.drawCIGARMatchesOnly,
            featPositionsBpPerPxs,
            view.drawLocationMarkers,
          )
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
          !view.views.every(
            a => a.displayedRegions.length > 0 && a.initialized,
          )
        ) {
          return
        }

        // access observables to track them (issue #3456)
        JSON.stringify(view.views.map(v => v.displayedRegions))
        view.views.map(v => v.bpPerPx)
        view.views.map(v => v.staticBlocks.contentBlocks.map(b => b.key))

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
              },
            )) as SyntenyRpcResult

            if (thisStopToken !== currentStopToken || !isAlive(self)) {
              return
            }

            featPositionsBpPerPxs = viewSnaps.map(v => v.bpPerPx)
            self.setFeatPositions(parseSyntenyRpcResult(result))
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
