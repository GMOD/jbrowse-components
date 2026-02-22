import {
  dedupe,
  getContainingView,
  getSession,
  makeAbortableReaction,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, getSnapshot } from '@jbrowse/mobx-state-tree'
import { parseCigar } from '@jbrowse/plugin-alignments'
import { autorun, reaction } from 'mobx'

import { createDotplotColorFunction } from './dotplotWebGLColors.ts'
import { buildLineSegments } from './drawDotplotWebGL.ts'

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

        const snapshotBpPerPxH = hview.bpPerPx
        const snapshotBpPerPxV = vview.bpPerPx

        const hViewSnap = {
          ...getSnapshot(hview),
          width: hview.width,
          staticBlocks: { contentBlocks: [], blocks: [] },
          interRegionPaddingWidth: hview.interRegionPaddingWidth,
          minimumBlockWidth: hview.minimumBlockWidth,
        }

        const vViewSnap = {
          ...getSnapshot(vview),
          width: vview.width,
          staticBlocks: { contentBlocks: [], blocks: [] },
          interRegionPaddingWidth: vview.interRegionPaddingWidth,
          minimumBlockWidth: vview.minimumBlockWidth,
        }

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
              cigar: parseCigar(result.cigars[i]),
            })
          }
        }
        self.setFeatPositions(positions, snapshotBpPerPxH, snapshotBpPerPxV)
      },
      { fireImmediately: true, delay: 300 },
    ),
  )

  let lastGeometryKey = ''
  let lastFeatPositions: DotplotFeatPos[] = []
  let lastRenderer: unknown = null
  let resizeSent = ''

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

        const hBpPerPx = hview.bpPerPx
        const vBpPerPx = vview.bpPerPx

        if (!self.gpuRenderer || !self.gpuInitialized) {
          return
        }

        if (self.gpuRenderer !== lastRenderer) {
          lastGeometryKey = ''
          lastRenderer = self.gpuRenderer
        }

        const resizeKey = `${viewWidth}-${viewHeight}`
        if (resizeKey !== resizeSent) {
          self.gpuRenderer.resize(viewWidth, viewHeight)
          resizeSent = resizeKey
        }

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

        if (
          geometryKey !== lastGeometryKey ||
          filteredPositions !== lastFeatPositions
        ) {
          const colorFn = createDotplotColorFunction(colorBy, alpha)
          const segments = buildLineSegments(
            filteredPositions,
            colorFn,
            drawCigar,
            hBpPerPx,
            vBpPerPx,
          )
          self.gpuRenderer.uploadGeometry({
            x1s: new Float32Array(segments.x1s),
            y1s: new Float32Array(segments.y1s),
            x2s: new Float32Array(segments.x2s),
            y2s: new Float32Array(segments.y2s),
            colors: new Float32Array(segments.colors),
            instanceCount: segments.x1s.length,
          })
          lastGeometryKey = geometryKey
          lastFeatPositions = filteredPositions
        }

        const scaleX =
          featPositionsBpPerPxH > 0 ? featPositionsBpPerPxH / hBpPerPx : 1
        const scaleY =
          featPositionsBpPerPxV > 0 ? featPositionsBpPerPxV / vBpPerPx : 1

        self.gpuRenderer.render(
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
