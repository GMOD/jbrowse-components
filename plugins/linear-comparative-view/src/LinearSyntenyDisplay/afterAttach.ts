import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, getSnapshot } from '@jbrowse/mobx-state-tree'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { autorun, reaction } from 'mobx'

import { createColorFunction } from './drawSyntenyWebGL.ts'

import type { FeatPos, LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { SyntenyFeatureData } from '../LinearSyntenyRPC/executeSyntenyWebGLGeometry.ts'

type LSV = LinearSyntenyViewModel

export function doAfterAttach(self: LinearSyntenyDisplayModel) {
  let lastGeometryKey = ''
  let lastFeatPositions: FeatPos[] = []
  let lastRenderer: unknown = null
  let edgeTimer: ReturnType<typeof setTimeout> | null = null
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

        const { alpha, colorBy, featPositions, level } = self
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
          const colorFn = createColorFunction(colorBy, alpha)
          const bpPerPxs = view.views.map(v => v.bpPerPx)
          self.webglRenderer.buildGeometry(
            featPositions,
            level,
            alpha,
            colorBy,
            colorFn,
            view.drawCurves,
            view.drawCIGAR,
            view.drawCIGARMatchesOnly,
            bpPerPxs,
            view.drawLocationMarkers,
          )
          lastGeometryKey = geometryKey
          lastFeatPositions = featPositions
        }

        const o0 = view.views[level]!.offsetPx
        const o1 = view.views[level + 1]!.offsetPx
        const bpPerPx0 = view.views[level]!.bpPerPx
        const bpPerPx1 = view.views[level + 1]!.bpPerPx

        const maxOffScreenPx = view.maxOffScreenDrawPx

        // Skip edges during scroll for performance, debounce a full
        // re-render with edges once scrolling stops
        self.webglRenderer.render(o0, o1, height, bpPerPx0, bpPerPx1, true, maxOffScreenPx)

        if (edgeTimer) {
          clearTimeout(edgeTimer)
        }
        edgeTimer = setTimeout(() => {
          self.webglRenderer?.render(o0, o1, height, bpPerPx0, bpPerPx1, false, maxOffScreenPx)
        }, 150)
      },
      {
        name: 'SyntenyDraw',
      },
    ),
  )

  // Compute feat positions on the worker via RPC. Uses a reaction so that
  // positions are only recomputed when bpPerPx or displayedRegions change.
  addDisposer(
    self,
    reaction(
      () => {
        if (self.isMinimized) {
          return { initialized: false }
        }
        const view = getContainingView(self) as LSV
        return {
          bpPerPx: view.views.map(v => v.bpPerPx),

          // stringifying 'deeply' accesses the displayed regions, see
          // issue #3456
          displayedRegions: JSON.stringify(
            view.views.map(v => v.displayedRegions),
          ),
          features: self.features,
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
        const { level } = self
        const { assemblyManager, rpcManager } = getSession(self)
        const view = getContainingView(self) as LSV
        const sessionId = getRpcSessionId(self)
        const viewSnaps = view.views.map(view => ({
          ...getSnapshot(view),
          width: view.width,
          staticBlocks: {
            contentBlocks: view.staticBlocks.contentBlocks,
            blocks: view.staticBlocks.blocks,
          },
          interRegionPaddingWidth: view.interRegionPaddingWidth,
          minimumBlockWidth: view.minimumBlockWidth,
        }))

        const feats = self.features || []
        const serializedFeatures = [] as SyntenyFeatureData[]
        for (const f of feats) {
          const mate = f.get('mate')
          const a1 = assemblyManager.get(f.get('assemblyName'))
          const a2 = assemblyManager.get(mate.assemblyName)
          const r1 = f.get('refName')
          const r2 = mate.refName
          serializedFeatures.push({
            id: f.id(),
            refName1: a1?.getCanonicalRefName(r1) || r1,
            refName2: a2?.getCanonicalRefName(r2) || r2,
            start: f.get('start'),
            end: f.get('end'),
            mateStart: mate.start,
            mateEnd: mate.end,
            strand: f.get('strand'),
            cigar: f.get('CIGAR') as string | undefined,
          })
        }

        const result = (await rpcManager.call(
          sessionId,
          'SyntenyGetWebGLGeometry',
          {
            features: serializedFeatures,
            viewSnaps,
            level,
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

        const featureMap = new Map(feats.map(f => [f.id(), f]))
        const map = [] as FeatPos[]
        for (let i = 0; i < result.featureIds.length; i++) {
          const f = featureMap.get(result.featureIds[i]!)
          if (!f) {
            continue
          }
          map.push({
            p11: { offsetPx: result.p11_offsetPx[i]! },
            p12: { offsetPx: result.p12_offsetPx[i]! },
            p21: { offsetPx: result.p21_offsetPx[i]! },
            p22: { offsetPx: result.p22_offsetPx[i]! },
            f,
            cigar: MismatchParser.parseCigar(result.cigars[i]),
          })
        }
        self.setFeatPositions(map)
      },
      { fireImmediately: true },
    ),
  )
}
