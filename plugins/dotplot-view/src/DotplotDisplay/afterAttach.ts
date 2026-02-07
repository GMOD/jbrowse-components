import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, getSnapshot } from '@jbrowse/mobx-state-tree'
import { autorun, reaction } from 'mobx'

import { createColorFunction } from './dotplotWebGLColors.ts'

import type { DotplotViewModel } from '../DotplotView/model.ts'
import type { DotplotDisplay as DotplotDisplayModel } from './stateModelFactory.tsx'

export function doAfterAttach(self: DotplotDisplayModel) {
  let lastGeometryKey = ''
  let lastRenderer: unknown = null
  let edgeTimer: ReturnType<typeof setTimeout> | null = null

  addDisposer(
    self,
    autorun(
      function dotplotDrawAutorun() {
        if (self.isMinimized) {
          return
        }

        const view = getContainingView(self) as DotplotViewModel
        if (!view.initialized) {
          return
        }

        if (
          !view.hview.displayedRegions.length ||
          !view.vview.displayedRegions.length
        ) {
          return
        }

        const { alpha, colorBy, featPositions } = self

        if (!self.webglRenderer || !self.webglInitialized) {
          return
        }

        if (self.webglRenderer !== lastRenderer) {
          lastGeometryKey = ''
          lastRenderer = self.webglRenderer
        }

        const geometryKey = `${featPositions.length}-${colorBy}-${alpha}`

        self.webglRenderer.resize(view.width, view.height)

        if (geometryKey !== lastGeometryKey) {
          const colorFn = createColorFunction(colorBy, alpha)
          self.webglRenderer.buildGeometry(featPositions, (feat) => {
            return colorFn(feat.f)
          })
          lastGeometryKey = geometryKey
        }

        const offsetX = view.hview.offsetPx
        const offsetY = view.vview.offsetPx

        self.webglRenderer.render(offsetX, offsetY, true)

        if (edgeTimer) {
          clearTimeout(edgeTimer)
        }
        edgeTimer = setTimeout(() => {
          self.webglRenderer?.render(offsetX, offsetY, false)
        }, 150)
      },
      {
        name: 'DotplotDraw',
        scheduler: (run) => requestAnimationFrame(run),
      },
    ),
  )

  addDisposer(
    self,
    reaction(
      () => {
        if (self.isMinimized) {
          return { initialized: false }
        }
        const view = getContainingView(self) as DotplotViewModel
        return {
          hBpPerPx: view.hview.bpPerPx,
          vBpPerPx: view.vview.bpPerPx,
          hDisplayedRegions: JSON.stringify(view.hview.displayedRegions),
          vDisplayedRegions: JSON.stringify(view.vview.displayedRegions),
          features: view.hview.features,
          initialized: view.initialized,
          alpha: self.alpha,
          minAlignmentLength: self.minAlignmentLength,
        }
      },
      async () => {
        const view = getContainingView(self) as DotplotViewModel
        if (!view.initialized) {
          return
        }

        const features = view.hview.features || []
        if (features.length === 0) {
          self.setFeatPositions([])
          return
        }

        const { rpcManager } = getSession(self)
        const sessionId = getRpcSessionId(self)
        const hViewSnap = {
          ...getSnapshot(view.hview),
          staticBlocks: {
            contentBlocks: view.hview.staticBlocks.contentBlocks,
            blocks: view.hview.staticBlocks.blocks,
          },
          width: view.hview.width,
          interRegionPaddingWidth: view.hview.interRegionPaddingWidth,
          minimumBlockWidth: view.hview.minimumBlockWidth,
        }
        const vViewSnap = {
          ...getSnapshot(view.vview),
          staticBlocks: {
            contentBlocks: view.vview.staticBlocks.contentBlocks,
            blocks: view.vview.staticBlocks.blocks,
          },
          width: view.vview.width,
          interRegionPaddingWidth: view.vview.interRegionPaddingWidth,
          minimumBlockWidth: view.vview.minimumBlockWidth,
        }

        const serializedFeatures = features.map((f: any) => ({
          id: f.id?.() || String(Math.random()),
          refName: f.get('refName'),
          start: f.get('start'),
          end: f.get('end'),
          mateStart: f.get('mate').start,
          mateEnd: f.get('mate').end,
          strand: f.get('strand') ?? 1,
          cigar: f.get('CIGAR') ?? '',
        }))

        try {
          const result = await rpcManager.call(
            sessionId,
            'DotplotGetWebGLGeometry',
            {
              features: serializedFeatures,
              hViewSnap,
              vViewSnap,
              height: view.height,
              minAlignmentLength: self.minAlignmentLength,
            },
          )

          const featPositions = []
          for (let i = 0; i < result.featureIds.length; i++) {
            const feat = features.find(
              (f: any) => (f.id?.() || String(Math.random())) === result.featureIds[i],
            )
            if (feat) {
              featPositions.push({
                x1: { offsetPx: result.x1_offsetPx[i] },
                x2: { offsetPx: result.x2_offsetPx[i] },
                y1: { offsetPx: result.y1_offsetPx[i] },
                y2: { offsetPx: result.y2_offsetPx[i] },
                f: feat,
                cigar: result.cigars[i] ? result.cigars[i].split(/(\d+)/).filter(Boolean) : [],
              })
            }
          }

          self.setFeatPositions(featPositions)
        } catch (e) {
          console.error('Error computing WebGL geometry:', e)
          self.setFeatPositions([])
        }
      },
    ),
  )
}
