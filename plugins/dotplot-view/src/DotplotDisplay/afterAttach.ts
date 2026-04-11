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
import type { Feature, ViewSnap } from '@jbrowse/core/util'

const RPC_DEBOUNCE_MS = 1000

function makeViewSnap(view: {
  width: number
  interRegionPaddingWidth: number
  minimumBlockWidth: number
}): ViewSnap {
  const snap = getSnapshot(
    view as Parameters<typeof getSnapshot>[0],
  ) as ViewSnap
  return {
    ...snap,
    width: view.width,
    staticBlocks: { contentBlocks: [], blocks: [] },
    interRegionPaddingWidth: view.interRegionPaddingWidth,
    minimumBlockWidth: view.minimumBlockWidth,
  }
}

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
      const rawFeatures = await rpcManager.call(sessionId, 'CoreGetFeatures', {
        regions,
        adapterConfig,
      })
      return { features: dedupe(rawFeatures, f => f.id()) }
    },
    {
      name: `${self.type} ${self.id} feature loading`,
      delay: RPC_DEBOUNCE_MS,
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

        const hViewSnap = makeViewSnap(hview)
        const vViewSnap = makeViewSnap(vview)

        if (self.features !== cachedFeatures) {
          cachedFeatures = self.features
          cachedSerialized = serializeFeatures(self.features, assemblyManager)
        }

        const result = await rpcManager.call(
          sessionId,
          'DotplotGetWebGLGeometry',
          {
            features: cachedSerialized,
            hViewSnap,
            vViewSnap,
            sessionId,
          },
        )

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
      { fireImmediately: true, delay: RPC_DEBOUNCE_MS },
    ),
  )

  let lastFeatPositions: DotplotFeatPos[] | undefined
  let lastUploadSettings = ''
  let lastRenderer: typeof self.gpuRenderer = null

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
          gpuRenderer: renderer,
          minAlignmentLength,
        } = self
        const { viewWidth, viewHeight, hview, vview, drawCigar } = view
        const hBpPerPx = hview.bpPerPx
        const vBpPerPx = vview.bpPerPx

        if (!renderer) {
          return
        }

        if (renderer !== lastRenderer) {
          lastFeatPositions = undefined
          lastUploadSettings = ''
          lastRenderer = renderer
        }

        renderer.resize(viewWidth, viewHeight)

        const settingsKey = `${colorBy}-${alpha}-${drawCigar}-${minAlignmentLength}`
        if (
          featPositions !== lastFeatPositions ||
          settingsKey !== lastUploadSettings
        ) {
          let filtered = featPositions
          if (minAlignmentLength > 0) {
            filtered = featPositions.filter(fp => {
              const len = Math.abs(fp.f.get('end') - fp.f.get('start'))
              return len >= minAlignmentLength
            })
          }
          const colorFn = createDotplotColorFunction(colorBy, alpha)
          const segments = buildLineSegments(
            filtered,
            colorFn,
            drawCigar,
            hBpPerPx,
            vBpPerPx,
          )
          renderer.uploadGeometry({
            x1s: new Float32Array(segments.x1s),
            y1s: new Float32Array(segments.y1s),
            x2s: new Float32Array(segments.x2s),
            y2s: new Float32Array(segments.y2s),
            colors: new Float32Array(segments.colors),
            instanceCount: segments.x1s.length,
          })
          lastFeatPositions = featPositions
          lastUploadSettings = settingsKey
        }

        const scaleX =
          featPositionsBpPerPxH > 0 ? featPositionsBpPerPxH / hBpPerPx : 1
        const scaleY =
          featPositionsBpPerPxV > 0 ? featPositionsBpPerPxV / vBpPerPx : 1

        renderer.render(hview.offsetPx, vview.offsetPx, 2, scaleX, scaleY)
        if (!self.canvasDrawn && self.features?.length) {
          self.setCanvasDrawn(true)
        }
      },
      { name: 'DotplotDraw' },
    ),
  )
}
