import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { createDotplotColorFunction } from './dotplotWebGLColors.ts'
import { buildLineSegments } from './drawDotplotWebGL.ts'

import type { DotplotGetFeaturesAndPositionsArgs } from './DotplotGetFeaturesAndPositions.ts'
import type { DotplotDisplayModel } from './stateModelFactory.tsx'
import type { Dotplot1DViewModel } from '../DotplotView/1dview.ts'
import type { DotplotViewModel } from '../DotplotView/model.ts'
import type { BpIndexViewSnap } from '@jbrowse/synteny-core'
import type { StopToken } from '@jbrowse/core/util/stopToken'

const RPC_DEBOUNCE_MS = 1000

function makeViewSnap(view: Dotplot1DViewModel): BpIndexViewSnap {
  return {
    bpPerPx: view.bpPerPx,
    displayedRegions: view.displayedRegions,
    interRegionPaddingWidth: view.interRegionPaddingWidth,
    minimumBlockWidth: view.minimumBlockWidth,
  }
}

// SYNC: stop-token autorun fetch skeleton mirrors afterAttach.ts in linear-comparative-view
export function doAfterAttach(
  self: Omit<DotplotDisplayModel, 'afterAttach' | 'beforeDestroy'>,
) {
  let currentStopToken: StopToken | undefined

  addDisposer(
    self,
    autorun(
      async function dotplotFetchAutorun() {
        const view = getContainingView(self) as DotplotViewModel
        if (!view.initialized) {
          return
        }
        const regions = view.hview.dynamicBlocks.contentBlocks
        const { adapterConfig } = self
        const hViewSnap = makeViewSnap(view.hview)
        const vViewSnap = makeViewSnap(view.vview)

        if (currentStopToken) {
          stopStopToken(currentStopToken)
        }
        const thisStopToken = createStopToken()
        currentStopToken = thisStopToken
        self.setLoading(thisStopToken)

        try {
          const sessionId = getRpcSessionId(self)
          const result = await getSession(self).rpcManager.call(
            sessionId,
            'DotplotGetFeaturesAndPositions',
            {
              sessionId,
              adapterConfig,
              regions,
              hViewSnap,
              vViewSnap,
              stopToken: thisStopToken,
            } satisfies DotplotGetFeaturesAndPositionsArgs,
          )
          if (thisStopToken !== currentStopToken || !isAlive(self)) {
            return
          }
          self.setRpcData(result)
        } catch (e) {
          if (
            thisStopToken === currentStopToken &&
            !isAbortException(e) &&
            isAlive(self)
          ) {
            self.setError(e)
          }
        }
      },
      { name: 'DotplotFetch', delay: RPC_DEBOUNCE_MS },
    ),
  )

  addDisposer(
    self,
    autorun(
      function dotplotGeometryRecompute() {
        const view = getContainingView(self) as DotplotViewModel
        const { rpcData, alpha, colorBy, minAlignmentLength } = self
        if (!rpcData) {
          return
        }
        const { drawCigar, hview, vview } = view
        const segments = buildLineSegments(
          rpcData,
          createDotplotColorFunction(colorBy, alpha, rpcData),
          drawCigar,
          minAlignmentLength,
          hview.bpPerPx,
          vview.bpPerPx,
        )
        self.setGeometry({
          x1Hi: segments.x1Hi,
          x1Lo: segments.x1Lo,
          y1Hi: segments.y1Hi,
          y1Lo: segments.y1Lo,
          x2Hi: segments.x2Hi,
          x2Lo: segments.x2Lo,
          y2Hi: segments.y2Hi,
          y2Lo: segments.y2Lo,
          padHs: segments.padHs,
          padVs: segments.padVs,
          colors: segments.colors,
          instanceCount: segments.count,
        })
      },
      { name: 'DotplotGeometryRecompute' },
    ),
  )

  addDisposer(self, () => {
    if (currentStopToken) {
      stopStopToken(currentStopToken)
    }
  })
}
