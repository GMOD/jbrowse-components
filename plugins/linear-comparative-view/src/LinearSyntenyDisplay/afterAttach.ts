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

        const {
          alpha,
          featureData,
          level,
          minAlignmentLength,
          hoveredFeatureIdx,
          clickedFeatureIdx,
        } = self
        const gpuInstanceData = self.gpuInstanceData
        const height = self.height
        const width = view.width

        if (!self.gpuRenderer || !self.gpuInitialized) {
          return
        }

        if (self.gpuRenderer !== lastRenderer) {
          lastInstanceData = undefined
          lastRenderer = self.gpuRenderer
        }

        self.gpuRenderer.resize(width, height)

        if (gpuInstanceData && gpuInstanceData !== lastInstanceData) {
          lastInstanceData = gpuInstanceData
          self.gpuRenderer.uploadGeometry(gpuInstanceData)
        }

        if (!featureData) {
          return
        }

        const v0 = view.views[level]!
        const v1 = view.views[level + 1]!
        const maxOffScreenPx = view.maxOffScreenDrawPx

        const hoveredFeatureId =
          hoveredFeatureIdx >= 0 ? hoveredFeatureIdx + 1 : 0
        const clickedFeatureId =
          clickedFeatureIdx >= 0 ? clickedFeatureIdx + 1 : 0

        self.gpuRenderer.render(
          v0.offsetPx,
          v1.offsetPx,
          height,
          v0.bpPerPx,
          v1.bpPerPx,
          maxOffScreenPx,
          minAlignmentLength,
          alpha,
          hoveredFeatureId,
          clickedFeatureId,
        )
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

            const { instanceData, ...featureData } = result
            self.setFeatureData(featureData)
            self.setGpuInstanceData(instanceData)
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
