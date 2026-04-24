import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { parseCigar } from '@jbrowse/plugin-alignments'
import { autorun } from 'mobx'

import { createDotplotColorFunction } from './dotplotWebGLColors.ts'
import { buildLineSegments } from './drawDotplotWebGL.ts'

import type { DotplotDisplayModel } from './stateModelFactory.tsx'
import type { DotplotRpcData } from './types.ts'
import type { Dotplot1DViewModel } from '../DotplotView/1dview.ts'
import type { DotplotViewModel } from '../DotplotView/model.ts'
import type { ViewSnap } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

const RPC_DEBOUNCE_MS = 1000

function makeViewSnap(view: Dotplot1DViewModel): ViewSnap {
  return {
    bpPerPx: view.bpPerPx,
    offsetPx: view.offsetPx,
    displayedRegions: view.displayedRegions,
    staticBlocks: { contentBlocks: [], blocks: [] },
    interRegionPaddingWidth: view.interRegionPaddingWidth,
    minimumBlockWidth: view.minimumBlockWidth,
    width: view.width,
  }
}

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
            },
          )
          if (thisStopToken !== currentStopToken || !isAlive(self)) {
            return
          }
          const cigars = result.cigars
          const parsedCigars = new Array<string[]>(cigars.length)
          for (let i = 0; i < cigars.length; i++) {
            parsedCigars[i] = cigars[i] ? parseCigar(cigars[i]) : []
          }
          const rpcData: DotplotRpcData = {
            parsedCigars,
            p11s: result.p11_offsetPx,
            p12s: result.p12_offsetPx,
            p21s: result.p21_offsetPx,
            p22s: result.p22_offsetPx,
            strands: result.strands,
            starts: result.starts,
            ends: result.ends,
            identities: result.identities,
            meanScores: result.meanScores,
            mappingQuals: result.mappingQuals,
            refNames: result.refNames,
            bpPerPxH: result.bpPerPxH,
            bpPerPxV: result.bpPerPxV,
          }
          self.setRpcData(rpcData)
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
        const { drawCigar } = view
        const segments = buildLineSegments(
          rpcData,
          createDotplotColorFunction(colorBy, alpha, rpcData),
          drawCigar,
          minAlignmentLength,
        )
        self.setGeometry({
          x1s: segments.x1s,
          y1s: segments.y1s,
          x2s: segments.x2s,
          y2s: segments.y2s,
          colors: segments.colors,
          instanceCount: segments.count,
          bpPerPxH: rpcData.bpPerPxH,
          bpPerPxV: rpcData.bpPerPxV,
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
