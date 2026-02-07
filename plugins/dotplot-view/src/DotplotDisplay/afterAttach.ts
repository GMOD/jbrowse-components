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
import type { DotplotFeatPos, DotplotFeatureData } from './types.ts'
import type { DotplotViewModel } from '../DotplotView/model.ts'
import type { Feature } from '@jbrowse/core/util'

function serializeFeatures(
  features: Feature[],
  assemblyManager: { get: (name: string) => any },
) {
  const serialized: DotplotFeatureData[] = []
  for (const f of features) {
    const mate = f.get('mate')
    const refName = f.get('refName')
    const mateRefName = mate.refName
    const a1 = assemblyManager.get(f.get('assemblyName'))
    const a2 = assemblyManager.get(mate.assemblyName)
    serialized.push({
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
  return serialized
}

export function doAfterAttach(self: Omit<DotplotDisplayModel, 'afterAttach'>) {
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
      const rawFeatures = (await rpcManager.call(sessionId, 'CoreGetFeatures', {
        regions,
        sessionId,
        adapterConfig,
      })) as Feature[]
      return { features: dedupe(rawFeatures, f => f.id()) }
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

  // Reaction 2: Compute feat positions on the worker via RPC.
  // Cached serialized features avoid re-serialization on zoom-only changes.
  let cachedFeatures: Feature[] | undefined
  let cachedSerialized: DotplotFeatureData[] = []

  addDisposer(
    self,
    reaction(
      () => {
        try {
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
        } catch {
          return { initialized: false as const }
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

        // Capture bpPerPx at this moment — the RPC will compute positions
        // at this zoom level. We store it alongside the positions so the
        // draw autorun can compute the correct scale factor.
        const snapshotBpPerPxH = hview.bpPerPx
        const snapshotBpPerPxV = vview.bpPerPx

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

        // Only re-serialize when features actually change
        if (self.features !== cachedFeatures) {
          cachedFeatures = self.features
          cachedSerialized = serializeFeatures(self.features, assemblyManager)
        }

        const result = (await rpcManager.call(
          sessionId,
          'DotplotGetWebGLGeometry',
          {
            features: cachedSerialized,
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
          if (f) {
            positions.push({
              p11: result.p11_offsetPx[i]!,
              p12: result.p12_offsetPx[i]!,
              p21: result.p21_offsetPx[i]!,
              p22: result.p22_offsetPx[i]!,
              f,
              cigar: MismatchParser.parseCigar(result.cigars[i]),
            })
          }
        }
        self.setFeatPositions(positions, snapshotBpPerPxH, snapshotBpPerPxV)
      },
      { fireImmediately: true, delay: 300 },
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
        let view: DotplotViewModel
        try {
          view = getContainingView(self) as DotplotViewModel
        } catch {
          return
        }
        if (!view.initialized) {
          return
        }

        const {
          alpha,
          colorBy,
          featPositions,
          featPositionsBpPerPxH,
          featPositionsBpPerPxV,
          minAlignmentLength,
        } = self
        const { viewWidth, viewHeight, hview, vview, drawCigar } = view

        // Always read bpPerPx so MobX tracks it and reruns on zoom
        const hBpPerPx = hview.bpPerPx
        const vBpPerPx = vview.bpPerPx

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
            hBpPerPx,
            vBpPerPx,
          )
          lastGeometryKey = geometryKey
          lastFeatPositions = filteredPositions
        }

        // Scale factors: ratio of the bpPerPx at which Reaction 2 computed
        // the positions to the current bpPerPx. During zoom (before new
        // geometry arrives from the RPC), this stretches/shrinks the existing
        // geometry to match the new zoom level.
        const scaleX =
          featPositionsBpPerPxH > 0 ? featPositionsBpPerPxH / hBpPerPx : 1
        const scaleY =
          featPositionsBpPerPxV > 0 ? featPositionsBpPerPxV / vBpPerPx : 1

        self.webglRenderer.render(
          hview.offsetPx,
          vview.offsetPx,
          2,
          scaleX,
          scaleY,
        )
      },
      {
        name: 'DotplotDraw',
        scheduler: run => requestAnimationFrame(run),
      },
    ),
  )
}
