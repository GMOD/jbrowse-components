import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer } from '@jbrowse/mobx-state-tree'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { autorun, reaction } from 'mobx'

import { createColorFunction } from './drawSyntenyWebGL.ts'

import type { FeatPos, LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { SyntenyFeatureData } from '../LinearSyntenyRPC/executeSyntenyWebGLGeometry.ts'
import type { Feature } from '@jbrowse/core/util'

type LSV = LinearSyntenyViewModel

export function doAfterAttach(self: LinearSyntenyDisplayModel) {
  let lastGeometryKey = ''
  let lastFeatPositions: FeatPos[] = []
  let lastRenderer: unknown = null
  let edgeTimer: ReturnType<typeof setTimeout> | null = null
  let buildTimer: ReturnType<typeof setTimeout> | null = null
  // bpPerPx values at which featPositions were computed (by the RPC).
  // buildGeometry uses these as the "reference" so the shader's scale
  // compensation (geometryBpPerPx / currentBpPerPx) is correct.
  let featPositionsBpPerPxs: number[] = []

  // Runs buildGeometry with the latest model/view values.
  // Defined outside the autorun so it reads fresh values at call time
  // rather than stale closure captures.
  function runBuildGeometry() {
    if (!self.webglRenderer || !self.webglInitialized) {
      return
    }
    const view = getContainingView(self) as LinearSyntenyViewModel
    const { alpha, colorBy, featPositions, level } = self
    const colorFn = createColorFunction(colorBy, alpha)
    self.webglRenderer.buildGeometry(
      featPositions, level, alpha, colorBy, colorFn,
      view.drawCurves, view.drawCIGAR, view.drawCIGARMatchesOnly,
      featPositionsBpPerPxs, view.drawLocationMarkers,
    )
    // Re-render with the new geometry
    const o0 = view.views[level]!.offsetPx
    const o1 = view.views[level + 1]!.offsetPx
    const bpPerPx0 = view.views[level]!.bpPerPx
    const bpPerPx1 = view.views[level + 1]!.bpPerPx
    self.webglRenderer.render(
      o0, o1, self.height, bpPerPx0, bpPerPx1, false,
      view.maxOffScreenDrawPx, self.minAlignmentLength,
    )
  }

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

        const { alpha, colorBy, featPositions, level, minAlignmentLength } = self
        const height = self.height
        const width = view.width

        if (!self.webglRenderer || !self.webglInitialized) {
          return
        }

        // Reset geometry key when renderer changes (e.g. React StrictMode
        // re-creates the renderer)
        if (self.webglRenderer !== lastRenderer) {
          lastGeometryKey = ''
          lastRenderer = self.webglRenderer
        }

        const geometryKey = `${featPositions.length}-${colorBy}-${alpha}-${view.drawCurves}-${view.drawCIGAR}-${view.drawCIGARMatchesOnly}-${view.drawLocationMarkers}`

        // Always resize in case dimensions changed
        self.webglRenderer.resize(width, height)

        if (
          geometryKey !== lastGeometryKey ||
          featPositions !== lastFeatPositions
        ) {
          const settingsChanged = geometryKey !== lastGeometryKey
          lastGeometryKey = geometryKey
          lastFeatPositions = featPositions

          if (settingsChanged || !self.webglRenderer.hasGeometry()) {
            // Settings change or first build: immediate
            const colorFn = createColorFunction(colorBy, alpha)
            self.webglRenderer.buildGeometry(
              featPositions, level, alpha, colorBy, colorFn,
              view.drawCurves, view.drawCIGAR, view.drawCIGARMatchesOnly,
              featPositionsBpPerPxs, view.drawLocationMarkers,
            )
          } else {
            // Position-only change (zoom): debounce. The shader's scale
            // compensation (u_scale0/u_scale1) keeps rendering smooth
            // with the existing geometry in the meantime.
            if (buildTimer) {
              clearTimeout(buildTimer)
            }
            buildTimer = setTimeout(runBuildGeometry, 300)
          }
        }

        const o0 = view.views[level]!.offsetPx
        const o1 = view.views[level + 1]!.offsetPx
        const bpPerPx0 = view.views[level]!.bpPerPx
        const bpPerPx1 = view.views[level + 1]!.bpPerPx

        const maxOffScreenPx = view.maxOffScreenDrawPx

        // Skip edges during scroll for performance, debounce a full
        // re-render with edges once scrolling stops
        self.webglRenderer.render(o0, o1, height, bpPerPx0, bpPerPx1, true, maxOffScreenPx, minAlignmentLength)

        if (edgeTimer) {
          clearTimeout(edgeTimer)
        }
        edgeTimer = setTimeout(() => {
          self.webglRenderer?.render(o0, o1, height, bpPerPx0, bpPerPx1, false, maxOffScreenPx, minAlignmentLength)
        }, 150)
      },
      {
        name: 'SyntenyDraw',
      },
    ),
  )

  // Cache for serialized features - only re-serialize when the features
  // array reference changes, avoiding repeated getCanonicalRefName calls
  // on every bpPerPx change
  let cachedFeatureRef: readonly Feature[] | undefined
  let cachedSerializedFeatures: SyntenyFeatureData[] = []
  // Cache for parsed CIGARs keyed by feature id
  let cachedCigarsByFeatureId = new Map<string, string[]>()

  // Compute feat positions on the worker via RPC. Tracks
  // displayedRegions, features, and bpPerPx. The shader's HP scale
  // compensation keeps rendering smooth during zoom; this reaction
  // fires after zoom stops (delay: 300) to correct inter-region
  // padding which is fixed-pixel and doesn't scale with bpPerPx.
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
          features: self.features,
          initialized:
            view.initialized &&
            view.views.every(
              a => a.displayedRegions.length > 0 && a.initialized,
            ),
        }
      },
      async ({ initialized, features }) => {
        if (!initialized) {
          return
        }
        const { level } = self
        const { assemblyManager, rpcManager } = getSession(self)
        const view = getContainingView(self) as LSV
        const sessionId = getRpcSessionId(self)

        // Only send the fields bpToPx actually needs, instead of the
        // entire MST view snapshot which is huge and expensive to
        // deep-clone in filterArgs/serializeArguments
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

        // Cache serialized features - only rebuild when the features
        // reference changes. This avoids repeated getCanonicalRefName
        // and feature.get() calls on every bpPerPx change.
        const feats = features ?? self.features
        if (!feats) {
          return
        }
        if (feats !== cachedFeatureRef) {
          cachedFeatureRef = feats
          cachedSerializedFeatures = []
          cachedCigarsByFeatureId = new Map()
          for (const f of feats) {
            const mate = f.get('mate')
            const a1 = assemblyManager.get(f.get('assemblyName'))
            const a2 = assemblyManager.get(mate.assemblyName)
            const r1 = f.get('refName')
            const r2 = mate.refName
            const id = f.id()
            const cigarStr = f.get('CIGAR') as string | undefined
            cachedSerializedFeatures.push({
              id,
              refName1: a1?.getCanonicalRefName(r1) || r1,
              refName2: a2?.getCanonicalRefName(r2) || r2,
              start: f.get('start'),
              end: f.get('end'),
              mateStart: mate.start,
              mateEnd: mate.end,
              strand: f.get('strand'),
            })
            // Pre-parse and cache CIGAR strings on the main thread
            // instead of round-tripping them through RPC
            cachedCigarsByFeatureId.set(
              id,
              MismatchParser.parseCigar(cigarStr),
            )
          }
        }

        const result = (await rpcManager.call(
          sessionId,
          'SyntenyGetWebGLGeometry',
          {
            features: cachedSerializedFeatures,
            viewSnaps,
            level,
            sessionId,
          },
        )) as {
          p11_offsetPx: Float64Array
          p12_offsetPx: Float64Array
          p21_offsetPx: Float64Array
          p22_offsetPx: Float64Array
          featureIds: string[]
        }

        const featureMap = new Map(feats.map(f => [f.id(), f]))
        const map = [] as FeatPos[]
        for (let i = 0; i < result.featureIds.length; i++) {
          const fid = result.featureIds[i]!
          const f = featureMap.get(fid)
          if (!f) {
            continue
          }
          map.push({
            p11: { offsetPx: result.p11_offsetPx[i]! },
            p12: { offsetPx: result.p12_offsetPx[i]! },
            p21: { offsetPx: result.p21_offsetPx[i]! },
            p22: { offsetPx: result.p22_offsetPx[i]! },
            f,
            cigar: cachedCigarsByFeatureId.get(fid) || [],
          })
        }
        featPositionsBpPerPxs = viewSnaps.map(v => v.bpPerPx)
        self.setFeatPositions(map)
      },
      { fireImmediately: true, delay: 300 },
    ),
  )
}
