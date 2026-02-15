import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { LinearSyntenyDisplayModel, SyntenyFeatureData } from './model.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'

type LSV = LinearSyntenyViewModel

export interface SyntenyRpcResult extends SyntenyFeatureData {
  instanceData: SyntenyInstanceData
}

export function doAfterAttach(self: LinearSyntenyDisplayModel) {
  let lastInstanceData: SyntenyInstanceData | undefined
  let lastRenderer: unknown = null
  let currentStopToken: StopToken | undefined

  let drawAutorunCount = 0
  let lastDrawLogTime = 0

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

        const t0 = performance.now()

        const { alpha, featureData, level, minAlignmentLength } = self
        const webglInstanceData = self.webglInstanceData
        const height = self.height
        const width = view.width
        const isScrolling =
          self.isScrolling ||
          view.views.some(
            v => (v as unknown as { isScrolling?: boolean }).isScrolling,
          )

        if (!self.webglRenderer || !self.webglInitialized) {
          return
        }

        if (self.webglRenderer !== lastRenderer) {
          lastInstanceData = undefined
          lastRenderer = self.webglRenderer
        }

        const t1 = performance.now()
        self.webglRenderer.resize(width, height)

        const t2 = performance.now()
        let didUpload = false
        if (webglInstanceData && webglInstanceData !== lastInstanceData) {
          didUpload = true
          lastInstanceData = webglInstanceData
          self.webglRenderer.uploadGeometry(webglInstanceData, view.drawCurves)
        }

        const t3 = performance.now()
        if (!featureData) {
          return
        }

        const o0 = view.views[level]!.offsetPx
        const o1 = view.views[level + 1]!.offsetPx
        const bpPerPx0 = view.views[level]!.bpPerPx
        const bpPerPx1 = view.views[level + 1]!.bpPerPx

        const maxOffScreenPx = view.maxOffScreenDrawPx

        self.webglRenderer.render(
          o0,
          o1,
          height,
          bpPerPx0,
          bpPerPx1,
          false,
          maxOffScreenPx,
          minAlignmentLength,
          alpha,
          isScrolling,
        )

        const t4 = performance.now()
        drawAutorunCount++
        const now = performance.now()
        if (now - lastDrawLogTime > 2000) {
          console.log(
            `[SyntenyDraw] ${drawAutorunCount} calls in last 2s | ` +
              `this frame: observables=${(t1 - t0).toFixed(2)}ms, ` +
              `resize=${(t2 - t1).toFixed(2)}ms, ` +
              `upload=${didUpload ? (t3 - t2).toFixed(2) + 'ms (NEW GEOMETRY)' : 'skipped'}, ` +
              `render=${(t4 - t3).toFixed(2)}ms, ` +
              `total=${(t4 - t0).toFixed(2)}ms | ` +
              `isScrolling=${isScrolling}, instances=${self.webglRenderer.getInstanceCount()}`,
          )
          drawAutorunCount = 0
          lastDrawLogTime = now
        }
      },
      {
        name: 'SyntenyDraw',
      },
    ),
  )

  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  addDisposer(
    self,
    autorun(
      function syntenyFetchAutorun() {
        if (self.isMinimized) {
          return
        }
        const view = getContainingView(self) as LSV
        if (
          !view.initialized ||
          !view.views.every(a => a.displayedRegions.length > 0 && a.initialized)
        ) {
          return
        }

        // access observables to track them (issue #3456)
        JSON.stringify(view.views.map(v => v.displayedRegions))
        view.views.map(v => v.bpPerPx)
        view.views.map(v => v.staticBlocks.contentBlocks.map(b => b.key))

        // Track rendering settings so RPC re-fires when they change
        const colorBy = self.colorBy
        const drawCurves = view.drawCurves
        const drawCIGAR = view.drawCIGAR
        const drawCIGARMatchesOnly = view.drawCIGARMatchesOnly
        const drawLocationMarkers = view.drawLocationMarkers

        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
        if (currentStopToken) {
          stopStopToken(currentStopToken)
        }

        const thisStopToken = createStopToken()
        currentStopToken = thisStopToken

        debounceTimer = setTimeout(async () => {
          try {
            const { level, adapterConfig } = self
            const { rpcManager } = getSession(self)
            const view = getContainingView(self) as LSV
            if (
              !view.initialized ||
              !view.views.every(
                a => a.displayedRegions.length > 0 && a.initialized,
              )
            ) {
              return
            }
            const sessionId = getRpcSessionId(self)

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

            const regions = view.views[level]!.staticBlocks.contentBlocks

            const result = (await rpcManager.call(
              sessionId,
              'SyntenyGetFeaturesAndPositions',
              {
                adapterConfig,
                regions,
                viewSnaps,
                level,
                sessionId,
                stopToken: thisStopToken,
                colorBy,
                drawCurves,
                drawCIGAR,
                drawCIGARMatchesOnly,
                drawLocationMarkers,
              },
            )) as SyntenyRpcResult

            if (thisStopToken !== currentStopToken || !isAlive(self)) {
              return
            }

            const featureData: SyntenyFeatureData = {
              p11_offsetPx: result.p11_offsetPx,
              p12_offsetPx: result.p12_offsetPx,
              p21_offsetPx: result.p21_offsetPx,
              p22_offsetPx: result.p22_offsetPx,
              strands: result.strands,
              starts: result.starts,
              ends: result.ends,
              identities: result.identities,
              padTop: result.padTop,
              padBottom: result.padBottom,
              featureIds: result.featureIds,
              names: result.names,
              refNames: result.refNames,
              assemblyNames: result.assemblyNames,
              cigars: result.cigars,
              mates: result.mates,
            }

            self.setFeatureData(featureData)
            self.setWebglInstanceData(result.instanceData)

            console.warn('[WebGL Synteny] RPC result processed:', {
              featureCount: featureData.featureIds.length,
              instanceDataCount: result.instanceData.instanceCount,
            })
          } catch (e) {
            if (!isAbortException(e)) {
              if (isAlive(self)) {
                console.error(e)
                self.setError(e)
              }
            }
          }
        }, 300)
      },
      { name: 'SyntenyFetch' },
    ),
  )
  addDisposer(self, () => {
    clearTimeout(debounceTimer)
    if (currentStopToken) {
      stopStopToken(currentStopToken)
    }
  })
}
