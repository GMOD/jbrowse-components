import { getContainingView, getSession } from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { addDisposer, getSnapshot } from '@jbrowse/mobx-state-tree'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { autorun, reaction } from 'mobx'

import {
  drawCigarClickMap,
  drawMouseoverClickMap,
  drawRef,
} from './drawSynteny.ts'
import { createColorFunction } from './drawSyntenyWebGL.ts'

import type { LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { Feature } from '@jbrowse/core/util'

interface Pos {
  offsetPx: number
}

interface FeatPos {
  p11: Pos
  p12: Pos
  p21: Pos
  p22: Pos
  f: Feature
  cigar: string[]
}

type LSV = LinearSyntenyViewModel

export function doAfterAttach(self: LinearSyntenyDisplayModel) {
  let lastGeometryKey = ''
  let lastRenderer: unknown = null

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

        // WebGL rendering path
        if (view.useWebGL && self.webglRenderer && self.webglInitialized) {
          // Reset geometry key when renderer changes (e.g. React StrictMode
          // re-creates the renderer)
          if (self.webglRenderer !== lastRenderer) {
            lastGeometryKey = ''
            lastRenderer = self.webglRenderer
          }

          const geometryKey = `${featPositions.length}-${colorBy}-${alpha}-${view.drawCurves}-${view.drawCIGAR}-${view.drawCIGARMatchesOnly}-${view.drawLocationMarkers}`

          // Always resize in case dimensions changed
          self.webglRenderer.resize(width, height)

          if (geometryKey !== lastGeometryKey) {
            console.log('[WebGL Synteny] Building geometry', {
              featureCount: featPositions.length,
              colorBy,
              alpha,
              width,
              height,
              geometryKey,
            })
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
            console.log('[WebGL Synteny] Geometry built', {
              hasGeometry: self.webglRenderer.hasGeometry(),
            })
            lastGeometryKey = geometryKey
          }

          const offsets = view.views.map(v => v.offsetPx)
          self.webglRenderer.render(offsets[level]!, offsets[level + 1]!, height)
          self.webglRenderer.renderPicking(offsets[level]!, offsets[level + 1]!, height)
          return
        }

        // Canvas 2D rendering path
        const ctx1 = self.mainCanvas?.getContext('2d')
        const ctx3 = self.cigarClickMapCanvas?.getContext('2d')
        if (!ctx1 || !ctx3) {
          return
        }

        ctx1.clearRect(0, 0, width, height)
        drawRef(self, ctx1)
        drawCigarClickMap(self, ctx3)
      },
      { name: 'SyntenyDraw' },
    ),
  )

  addDisposer(
    self,
    autorun(
      function syntenyMouseoverAutorun() {
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
        // Access reactive properties so autorun is triggered when they change
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { clickId, mouseoverId } = self
        drawMouseoverClickMap(self)
      },
      { name: 'SyntenyMouseover' },
    ),
  )

  // this attempts to reduce recalculation of feature positions drawn by the
  // synteny view
  //
  // uses a reaction to say "we know the positions don't change in any relevant
  // way unless bpPerPx changes or displayedRegions changes"
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
      ({ initialized }) => {
        if (!initialized) {
          return
        }
        const { level } = self
        const { assemblyManager } = getSession(self)
        const view = getContainingView(self) as LSV
        const viewSnaps = view.views.map(view => ({
          ...getSnapshot(view),
          width: view.width,
          staticBlocks: view.staticBlocks,
          interRegionPaddingWidth: view.interRegionPaddingWidth,
          minimumBlockWidth: view.minimumBlockWidth,
        }))

        const map = [] as FeatPos[]
        const feats = self.features || []

        for (const f of feats) {
          const mate = f.get('mate')
          let f1s = f.get('start')
          let f1e = f.get('end')
          const f2s = mate.start
          const f2e = mate.end

          if (f.get('strand') === -1) {
            ;[f1e, f1s] = [f1s, f1e]
          }
          const a1 = assemblyManager.get(f.get('assemblyName'))
          const a2 = assemblyManager.get(mate.assemblyName)
          const r1 = f.get('refName')
          const r2 = mate.refName
          const ref1 = a1?.getCanonicalRefName(r1) || r1
          const ref2 = a2?.getCanonicalRefName(r2) || r2
          const v1 = viewSnaps[level]!
          const v2 = viewSnaps[level + 1]!
          const p11 = bpToPx({ self: v1, refName: ref1, coord: f1s })
          const p12 = bpToPx({ self: v1, refName: ref1, coord: f1e })
          const p21 = bpToPx({ self: v2, refName: ref2, coord: f2s })
          const p22 = bpToPx({ self: v2, refName: ref2, coord: f2e })

          if (
            p11 === undefined ||
            p12 === undefined ||
            p21 === undefined ||
            p22 === undefined
          ) {
            continue
          }

          const cigar = f.get('CIGAR') as string | undefined
          map.push({
            p11,
            p12,
            p21,
            p22,
            f,
            cigar: MismatchParser.parseCigar(cigar),
          })
        }

        self.setFeatPositions(map)
      },
      { fireImmediately: true },
    ),
  )
}
