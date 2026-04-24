import {
  dedupe,
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
import type { DotplotFeatPos, DotplotFeatureData } from './types.ts'
import type { Dotplot1DViewModel } from '../DotplotView/1dview.ts'
import type { DotplotViewModel } from '../DotplotView/model.ts'
import type { Feature, ViewSnap } from '@jbrowse/core/util'
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

export function doAfterAttach(
  self: Omit<DotplotDisplayModel, 'afterAttach' | 'beforeDestroy'>,
) {
  let featureStopToken: StopToken | undefined
  let positionStopToken: StopToken | undefined

  addDisposer(
    self,
    autorun(
      async function dotplotFeatureFetch() {
        const view = getContainingView(self) as DotplotViewModel
        if (!view.initialized) {
          return
        }
        const regions = view.hview.dynamicBlocks.contentBlocks
        const { adapterConfig } = self

        if (featureStopToken) {
          stopStopToken(featureStopToken)
        }
        const thisStopToken = createStopToken()
        featureStopToken = thisStopToken
        self.setLoading(thisStopToken)

        try {
          const sessionId = getRpcSessionId(self)
          const rawFeatures = (await getSession(self).rpcManager.call(
            sessionId,
            'CoreGetFeatures',
            { regions, adapterConfig },
          ))
          if (thisStopToken !== featureStopToken || !isAlive(self)) {
            return
          }
          self.setFeatures({ features: dedupe(rawFeatures, f => f.id()) })
        } catch (e) {
          if (
            thisStopToken === featureStopToken &&
            !isAbortException(e) &&
            isAlive(self)
          ) {
            self.setError(e)
          }
        }
      },
      { name: 'DotplotFeatures', delay: RPC_DEBOUNCE_MS },
    ),
  )

  // Features serialization is cached across pan-triggered position
  // re-fetches; serializeFeatures is O(N) and called once per fire.
  let cachedFeatures: Feature[] | undefined
  let cachedSerialized: DotplotFeatureData[] = []

  addDisposer(
    self,
    autorun(
      async function dotplotPositionsFetch() {
        const view = getContainingView(self) as DotplotViewModel
        if (!view.initialized || !self.features) {
          return
        }
        const { hview, vview } = view
        const bpPerPxH = hview.bpPerPx
        const bpPerPxV = vview.bpPerPx
        const hViewSnap = makeViewSnap(hview)
        const vViewSnap = makeViewSnap(vview)
        const features = self.features

        const { assemblyManager } = getSession(self)
        if (features !== cachedFeatures) {
          cachedFeatures = features
          cachedSerialized = serializeFeatures(features, assemblyManager)
        }

        if (positionStopToken) {
          stopStopToken(positionStopToken)
        }
        const thisStopToken = createStopToken()
        positionStopToken = thisStopToken

        try {
          const sessionId = getRpcSessionId(self)
          const result = await getSession(self).rpcManager.call(
            sessionId,
            'DotplotGetWebGLGeometry',
            {
              features: cachedSerialized,
              hViewSnap,
              vViewSnap,
              sessionId,
            },
          )
          if (thisStopToken !== positionStopToken || !isAlive(self)) {
            return
          }
          // result.featureIds is the input-order subsequence of features
          // that the worker kept (those outside visible regions are
          // filtered). Walk both arrays with a single output index.
          const positions: DotplotFeatPos[] = []
          const ids = result.featureIds
          let j = 0
          for (const f of features) {
            if (j < ids.length && f.id() === ids[j]) {
              positions.push({
                p11: result.p11_offsetPx[j]!,
                p12: result.p12_offsetPx[j]!,
                p21: result.p21_offsetPx[j]!,
                p22: result.p22_offsetPx[j]!,
                f,
                cigar: parseCigar(result.cigars[j]),
              })
              j++
            }
          }
          self.setFeatPositions({ positions, bpPerPxH, bpPerPxV })
        } catch (e) {
          if (
            thisStopToken === positionStopToken &&
            !isAbortException(e) &&
            isAlive(self)
          ) {
            self.setError(e)
          }
        }
      },
      { name: 'DotplotPositions', delay: RPC_DEBOUNCE_MS },
    ),
  )

  addDisposer(
    self,
    autorun(
      function dotplotGeometryRecompute() {
        const view = getContainingView(self) as DotplotViewModel
        const { featPositions, alpha, colorBy, minAlignmentLength } = self
        if (!view.initialized || !featPositions) {
          return
        }
        const { drawCigar } = view
        const { positions, bpPerPxH, bpPerPxV } = featPositions

        const filtered =
          minAlignmentLength > 0
            ? positions.filter(
                fp =>
                  Math.abs(fp.f.get('end') - fp.f.get('start')) >=
                  minAlignmentLength,
              )
            : positions

        const segments = buildLineSegments(
          filtered,
          createDotplotColorFunction(colorBy, alpha),
          drawCigar,
          bpPerPxH,
          bpPerPxV,
        )
        self.setGeometry({
          x1s: new Float32Array(segments.x1s),
          y1s: new Float32Array(segments.y1s),
          x2s: new Float32Array(segments.x2s),
          y2s: new Float32Array(segments.y2s),
          colors: new Uint32Array(segments.colors),
          instanceCount: segments.x1s.length,
          bpPerPxH,
          bpPerPxV,
        })
      },
      { name: 'DotplotGeometryRecompute' },
    ),
  )

  addDisposer(self, () => {
    if (featureStopToken) {
      stopStopToken(featureStopToken)
    }
    if (positionStopToken) {
      stopStopToken(positionStopToken)
    }
  })
}
