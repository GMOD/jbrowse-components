import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, reaction } from 'mobx'

import { createColorFunction } from './drawSyntenyWebGL.ts'

import type { FeatPos, LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'

type LSV = LinearSyntenyViewModel

function parseCigar(s = '') {
  let currLen = ''
  const ret = []
  for (let i = 0, l = s.length; i < l; i++) {
    const c = s[i]!
    if (c >= '0' && c <= '9') {
      currLen = currLen + c
    } else {
      ret.push(currLen, c)
      currLen = ''
    }
  }
  return ret
}

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
          !view.views.every(a => a.displayedRegions.length > 0 && a.initialized)
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

  // Merged RPC: fetches features AND computes positions on the worker,
  // returning only typed arrays + plain data (no Feature objects through
  // postMessage). Tracks displayedRegions and bpPerPx.
  addDisposer(
    self,
    reaction(
      () => {
        if (self.isMinimized) {
          return { initialized: false }
        }
        const view = getContainingView(self) as LSV
        return {
          // stringifying 'deeply' accesses the displayed regions, see
          // issue #3456
          displayedRegions: JSON.stringify(
            view.views.map(v => v.displayedRegions),
          ),
          bpPerPx: view.views.map(v => v.bpPerPx).join(','),
          // track visible content blocks so we re-fetch when new regions
          // scroll into view (staticBlocks depends on offsetPx)
          contentBlockKeys: view.views
            .map(v => v.staticBlocks.contentBlocks.map(b => b.key).join(','))
            .join('|'),
          initialized:
            view.initialized &&
            view.views.every(
              a => a.displayedRegions.length > 0 && a.initialized,
            ),
        }
      },
      async ({ initialized }) => {
        if (!initialized) {
          return
        }
        if (currentStopToken) {
          stopStopToken(currentStopToken)
        }
        const thisStopToken = createStopToken()
        currentStopToken = thisStopToken

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
          )) as {
            p11_offsetPx: Float64Array
            p12_offsetPx: Float64Array
            p21_offsetPx: Float64Array
            p22_offsetPx: Float64Array
            strands: Int8Array
            starts: Float64Array
            ends: Float64Array
            identities: Float64Array
            padTop: Float64Array
            padBottom: Float64Array
            featureIds: string[]
            names: string[]
            refNames: string[]
            assemblyNames: string[]
            cigars: string[]
            mates: {
              start: number
              end: number
              refName: string
              name: string
              assemblyName: string
            }[]
          }

          if (thisStopToken !== currentStopToken || !isAlive(self)) {
            return
          }

          const map: FeatPos[] = []
          for (let i = 0; i < result.featureIds.length; i++) {
            const identity = result.identities[i]!
            map.push({
              p11: { offsetPx: result.p11_offsetPx[i]! },
              p12: { offsetPx: result.p12_offsetPx[i]! },
              p21: { offsetPx: result.p21_offsetPx[i]! },
              p22: { offsetPx: result.p22_offsetPx[i]! },
              padTop: result.padTop[i]!,
              padBottom: result.padBottom[i]!,
              id: result.featureIds[i]!,
              strand: result.strands[i]!,
              name: result.names[i]!,
              refName: result.refNames[i]!,
              start: result.starts[i]!,
              end: result.ends[i]!,
              assemblyName: result.assemblyNames[i]!,
              mate: result.mates[i]!,
              cigar: parseCigar(result.cigars[i]),
              identity: identity === -1 ? undefined : identity,
            })
          }
          featPositionsBpPerPxs = viewSnaps.map(v => v.bpPerPx)
          self.setFeatPositions(map)
        } catch (e) {
          if (!isAbortException(e)) {
            if (isAlive(self)) {
              console.error(e)
              self.setError(e)
            }
          }
        }
      },
      { fireImmediately: true, delay: 300 },
    ),
  )
  addDisposer(self, () => {
    if (currentStopToken) {
      stopStopToken(currentStopToken)
    }
  })
}
