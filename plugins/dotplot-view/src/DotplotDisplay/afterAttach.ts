import {
  dedupe,
  getContainingView,
  getSession,
  makeAbortableReaction,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, getSnapshot } from '@jbrowse/mobx-state-tree'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { autorun, reaction } from 'mobx'

import { createDotplotColorFunction } from './dotplotWebGLColors.ts'

import type { DotplotDisplayModel } from './stateModelFactory.tsx'
import type { DotplotFeatureData, DotplotFeatPos } from './types.ts'
import type { DotplotViewModel } from '../DotplotView/model.ts'
import type { Feature } from '@jbrowse/core/util'

export function doAfterAttach(self: DotplotDisplayModel) {
  // Reaction 1: Fetch features via CoreGetFeatures RPC
  makeAbortableReaction(
    self,
    () => {
      const view = getContainingView(self) as DotplotViewModel
      if (!view.initialized) {
        return undefined
      }
      const { hview } = view
      return {
        adapterConfig: self.adapterConfig,
        regions: hview.dynamicBlocks.contentBlocks,
        sessionId: getRpcSessionId(self),
      }
    },
    async args => {
      if (!args) {
        return undefined
      }
      const { rpcManager } = getSession(self)
      const { adapterConfig, regions, sessionId } = args
      return {
        features: dedupe(
          (await rpcManager.call(sessionId, 'CoreGetFeatures', {
            regions,
            sessionId,
            adapterConfig,
          })) as Feature[],
          f => f.id(),
        ),
      }
    },
    {
      name: `${self.type} ${self.id} feature loading`,
      delay: 500,
      fireImmediately: true,
    },
    self.setLoading,
    self.setFeatures,
    self.setError,
  )

  // Reaction 2: Compute feat positions on the worker via RPC
  addDisposer(
    self,
    reaction(
      () => {
        const view = getContainingView(self) as DotplotViewModel
        return {
          bpPerPx: [view.hview.bpPerPx, view.vview.bpPerPx],
          displayedRegions: JSON.stringify([
            view.hview.displayedRegions,
            view.vview.displayedRegions,
          ]),
          features: self.features,
          initialized: view.initialized,
        }
      },
      async ({ initialized }) => {
        if (!initialized || !self.features) {
          return
        }
        const { assemblyManager, rpcManager } = getSession(self)
        const view = getContainingView(self) as DotplotViewModel
        const sessionId = getRpcSessionId(self)
        const { hview, vview } = view

        const hViewSnap = {
          ...getSnapshot(hview),
          width: hview.width,
          staticBlocks: {
            contentBlocks: hview.staticBlocks.contentBlocks,
            blocks: hview.staticBlocks.blocks,
          },
          interRegionPaddingWidth: hview.interRegionPaddingWidth,
          minimumBlockWidth: hview.minimumBlockWidth,
        }

        const vViewSnap = {
          ...getSnapshot(vview),
          width: vview.width,
          staticBlocks: {
            contentBlocks: vview.staticBlocks.contentBlocks,
            blocks: vview.staticBlocks.blocks,
          },
          interRegionPaddingWidth: vview.interRegionPaddingWidth,
          minimumBlockWidth: vview.minimumBlockWidth,
        }

        const serializedFeatures: DotplotFeatureData[] = []
        for (const f of self.features) {
          const mate = f.get('mate')
          const refName = f.get('refName')
          const mateRefName = mate.refName
          const a1 = assemblyManager.get(f.get('assemblyName'))
          const a2 = assemblyManager.get(mate.assemblyName)
          serializedFeatures.push({
            id: f.id(),
            refName: a1?.getCanonicalRefName(refName) || refName,
            mateRefName: a2?.getCanonicalRefName(mateRefName) || mateRefName,
            start: f.get('start'),
            end: f.get('end'),
            mateStart: mate.start,
            mateEnd: mate.end,
            strand: f.get('strand') || 1,
            cigar: f.get('CIGAR') as string | undefined,
          })
        }

        const result = (await rpcManager.call(
          sessionId,
          'DotplotGetWebGLGeometry',
          {
            features: serializedFeatures,
            hViewSnap,
            vViewSnap,
            sessionId,
          },
        )) as {
          p11_offsetPx: Float32Array
          p12_offsetPx: Float32Array
          p21_offsetPx: Float32Array
          p22_offsetPx: Float32Array
          featureIds: string[]
          cigars: string[]
        }

        const featureMap = new Map(self.features.map(f => [f.id(), f]))
        const positions: DotplotFeatPos[] = []
        for (let i = 0; i < result.featureIds.length; i++) {
          const f = featureMap.get(result.featureIds[i]!)
          if (!f) {
            continue
          }
          positions.push({
            p11: { offsetPx: result.p11_offsetPx[i]! },
            p12: { offsetPx: result.p12_offsetPx[i]! },
            p21: { offsetPx: result.p21_offsetPx[i]! },
            p22: { offsetPx: result.p22_offsetPx[i]! },
            f,
            cigar: MismatchParser.parseCigar(result.cigars[i]),
          })
        }
        self.setFeatPositions(positions)
      },
      { fireImmediately: true },
    ),
  )

  // Reaction 3: Draw autorun with RAF scheduler
  let lastGeometryKey = ''
  let lastFeatPositions: DotplotFeatPos[] = []
  let lastRenderer: unknown = null

  addDisposer(
    self,
    autorun(
      function dotplotDrawAutorun() {
        const view = getContainingView(self) as DotplotViewModel
        if (!view.initialized) {
          return
        }

        const { alpha, colorBy, featPositions, minAlignmentLength } = self
        const { viewWidth, viewHeight, hview, vview, drawCigar } = view

        if (!self.webglRenderer || !self.webglInitialized) {
          return
        }

        // Reset geometry key when renderer changes (e.g. React StrictMode)
        if (self.webglRenderer !== lastRenderer) {
          lastGeometryKey = ''
          lastRenderer = self.webglRenderer
        }

        // Filter by minAlignmentLength
        let filteredPositions = featPositions
        if (minAlignmentLength > 0) {
          filteredPositions = featPositions.filter(fp => {
            const alignmentLength = Math.abs(
              fp.f.get('end') - fp.f.get('start'),
            )
            return alignmentLength >= minAlignmentLength
          })
        }

        const geometryKey = `${filteredPositions.length}-${colorBy}-${alpha}-${drawCigar}-${minAlignmentLength}`

        self.webglRenderer.resize(viewWidth, viewHeight)

        if (
          geometryKey !== lastGeometryKey ||
          filteredPositions !== lastFeatPositions
        ) {
          const colorFn = createDotplotColorFunction(colorBy, alpha)
          self.webglRenderer.buildGeometry(
            filteredPositions,
            colorFn,
            drawCigar,
            hview.bpPerPx,
            vview.bpPerPx,
          )
          lastGeometryKey = geometryKey
          lastFeatPositions = filteredPositions
        }

        self.webglRenderer.render(hview.offsetPx, vview.offsetPx, 2)
      },
      {
        name: 'DotplotDraw',
        scheduler: run => requestAnimationFrame(run),
      },
    ),
  )
}
