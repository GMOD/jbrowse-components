import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { createDotplotColorFunction } from './dotplotColors.ts'
import { buildLineSegments } from './dotplotGeometry.ts'

import type { DotplotGetFeaturesAndPositionsArgs } from './DotplotGetFeaturesAndPositions.ts'
import type { DotplotDisplayModel } from './stateModelFactory.tsx'
import type { Dotplot1DViewModel } from '../DotplotView/1dview.ts'
import type { DotplotViewModel } from '../DotplotView/model.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { BpIndexViewSnap, SyntenyColorBy } from '@jbrowse/synteny-core'

const RPC_DEBOUNCE_MS = 1000

function makeViewSnap(view: Dotplot1DViewModel): BpIndexViewSnap {
  return {
    bpPerPx: view.bpPerPx,
    displayedRegions: view.displayedRegions,
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
        const { lodMode } = view
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
              lodMode,
            } satisfies DotplotGetFeaturesAndPositionsArgs,
          )
          if (thisStopToken !== currentStopToken || !isAlive(self)) {
            return
          }
          self.setRpcData(result)
          const warnings: { message: string; effect: string }[] = []
          if (result.skippedFeatureCount > 0) {
            warnings.push({
              message: `${result.skippedFeatureCount} of ${result.totalFeatureCount} features could not be mapped to the configured assemblies`,
              effect:
                'This usually means chromosome names in the file do not match the assembly. Check assembly aliases or that the correct assemblies are selected.',
            })
          }
          // Nothing rendered and the adapter's X-axis refNames belong to the Y
          // assembly: the assemblies are reversed (only conclusive when their
          // chromosome names are distinct).
          if (result.assembliesSwapped) {
            warnings.push({
              message: 'No alignments mapped; the assemblies appear to be reversed',
              effect:
                'The chromosome names in the file match the opposite axis. Try switching the X and Y assemblies in the dotplot import form.',
            })
          }
          self.setWarnings(warnings)
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
        self.setGeometry(
          buildLineSegments(
            rpcData,
            createDotplotColorFunction(
              colorBy as SyntenyColorBy,
              alpha,
              rpcData,
            ),
            drawCigar,
            minAlignmentLength,
            hview.bpPerPx,
            vview.bpPerPx,
          ),
        )
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
