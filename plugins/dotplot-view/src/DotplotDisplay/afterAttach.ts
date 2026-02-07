import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, getSnapshot } from '@jbrowse/mobx-state-tree'
import { autorun, reaction } from 'mobx'

import { createColorFunction } from './dotplotWebGLColors.ts'

import type { DotplotViewModel } from '../DotplotView/model.ts'
import type { DotplotDisplay as DotplotDisplayModel } from './stateModelFactory.tsx'

async function fetchFeaturesFromAdapter(self: DotplotDisplayModel) {
  console.log('fetchFeaturesFromAdapter: fetching features')
  const view = getContainingView(self) as DotplotViewModel
  const { rpcManager, assemblyManager } = getSession(self)
  const sessionId = getRpcSessionId(self)

  try {
    const result = await rpcManager.call(
      sessionId,
      'CoreGetFeatures',
      {
        adapterConfig: self.adapterConfig,
        sessionId,
        regions: view.hview.displayedRegions,
        assemblyName: view.assemblyNames?.[0],
      },
    )
    console.log('fetchFeaturesFromAdapter: got', result?.length || 0, 'features')
    return result || []
  } catch (e) {
    console.error('fetchFeaturesFromAdapter: error:', e)
    return []
  }
}

export function doAfterAttach(self: DotplotDisplayModel) {
  console.log('doAfterAttach: called')
  let lastGeometryKey = ''
  let lastRenderer: unknown = null
  let edgeTimer: ReturnType<typeof setTimeout> | null = null

  addDisposer(
    self,
    autorun(
      function dotplotDrawAutorun() {
        console.log('dotplotDrawAutorun: executing')
        if (self.isMinimized) {
          console.log('dotplotDrawAutorun: minimized, returning')
          return
        }

        const view = getContainingView(self) as DotplotViewModel
        if (!view.initialized) {
          console.log('dotplotDrawAutorun: view not initialized, returning')
          return
        }

        if (
          !view.hview.displayedRegions.length ||
          !view.vview.displayedRegions.length
        ) {
          console.log('dotplotDrawAutorun: no displayed regions, returning')
          return
        }

        const { alpha, colorBy, featPositions } = self
        console.log('dotplotDrawAutorun: state', {
          alpha,
          colorBy,
          featPositions: featPositions.length,
        })

        if (!self.webglRenderer || !self.webglInitialized) {
          console.log('dotplotDrawAutorun: renderer not ready', {
            renderer: !!self.webglRenderer,
            initialized: self.webglInitialized,
          })
          return
        }

        if (self.webglRenderer !== lastRenderer) {
          lastGeometryKey = ''
          lastRenderer = self.webglRenderer
        }

        const geometryKey = `${featPositions.length}-${colorBy}-${alpha}`

        // Use viewWidth/viewHeight (plot area only) not full view width/height
        self.webglRenderer.resize(view.viewWidth, view.viewHeight)

        if (geometryKey !== lastGeometryKey) {
          const colorFn = createColorFunction(colorBy, alpha)
          self.webglRenderer.buildGeometry(featPositions, (feat) => {
            return colorFn(feat.f)
          })
          lastGeometryKey = geometryKey
        }

        // offsetPx is the scroll offset within the view
        const offsetX = view.hview.offsetPx
        const offsetY = view.vview.offsetPx
        console.log('dotplotDrawAutorun: rendering with scroll offset', {
          offsetX,
          offsetY,
          viewWidth: view.viewWidth,
          viewHeight: view.viewHeight,
          hBpPerPx: view.hview.bpPerPx,
          vBpPerPx: view.vview.bpPerPx,
        })

        self.webglRenderer.render(offsetX, offsetY)
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
          initialized: view.initialized,
          alpha: self.alpha,
          minAlignmentLength: self.minAlignmentLength,
        }
      },
      async () => {
        console.log('geometry reaction: executing')
        const view = getContainingView(self) as DotplotViewModel
        if (!view.initialized) {
          console.log('geometry reaction: view not initialized')
          return
        }

        // Try to get features from view first, then fetch from adapter
        let features = view.hview.features || []
        console.log('geometry reaction: hview.features.length=', features.length)

        if (features.length === 0) {
          console.log('geometry reaction: fetching features from adapter')
          features = await fetchFeaturesFromAdapter(self)
        }

        console.log('geometry reaction: using features.length=', features.length)
        if (features.length === 0) {
          console.log('geometry reaction: no features found, clearing positions')
          self.setFeatPositions([])
          return
        }

        const { rpcManager } = getSession(self)
        const sessionId = getRpcSessionId(self)
        console.log('geometry reaction: sessionId=', sessionId)
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
        console.log('geometry reaction: calling RPC with', serializedFeatures.length, 'features')

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
          console.log('geometry reaction: RPC returned', result.featureIds.length, 'valid features')

          console.log('geometry reaction: RPC result:', result)
          if (!result || !result.featureIds) {
            console.error('geometry reaction: invalid RPC result, expected featureIds')
            self.setFeatPositions([])
            return
          }

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
              })
            }
          }

          console.log('geometry reaction: set', featPositions.length, 'feature positions')
          self.setFeatPositions(featPositions)
        } catch (e) {
          console.error('geometry reaction: error computing WebGL geometry:', e)
          self.setFeatPositions([])
        }
      },
    ),
  )
}
