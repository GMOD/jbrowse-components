import React, { useCallback, useState } from 'react'

import { ErrorOverlay } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { useGpuModelLifecycle } from '@jbrowse/core/util/useGpuModelLifecycle'
import { observer } from 'mobx-react'

import { ManhattanRenderer } from '../ManhattanRenderer.ts'
import { findManhattanHit } from '../findManhattanHit.ts'
import { YSCALEBAR_LABEL_OFFSET } from '../manhattanDrawUtils.ts'
import TooltipComponent from './TooltipComponent.tsx'

import type { ManhattanRpcResult } from '../../RenderManhattanDataRPC/rpcTypes.ts'
import type { ManhattanHit } from '../findManhattanHit.ts'
import type { ManhattanBackend, ManhattanRenderState } from '../manhattanBackendTypes.ts'
import type { TooltipModel } from './TooltipComponent.tsx'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { GpuLifecycleModel } from '@jbrowse/core/util/useGpuModelLifecycle'
import type { ObservableMap } from 'mobx'

interface VisibleRegion {
  displayedRegionIndex: number
  refName: string
}

interface LGV {
  trackWidthPx: number
  visibleRegions: VisibleRegion[]
}

interface ManhattanDisplayModel extends GpuLifecycleModel<ManhattanBackend>, TooltipModel {
  canvasDrawn: boolean
  height: number
  manhattanRpcDataMap: ObservableMap<number, ManhattanRpcResult>
  manhattanRenderState: ManhattanRenderState | undefined
  renderBlocks: RenderBlock[]
  setManhattanFeatureUnderMouse(hit: ManhattanHit | undefined): void
}

const COORD0: [number, number] = [0, 0]

const LinearManhattanDisplayComponent = observer(function LinearManhattanDisplayComponent({
  model,
}: {
  model: ManhattanDisplayModel
}) {
  const { canvasRef, error, retry } = useGpuModelLifecycle(ManhattanRenderer, model)
  const view = getContainingView(model) as unknown as LGV
  const [clientMouseCoord, setClientMouseCoord] = useState(COORD0)

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      setClientMouseCoord([event.clientX, event.clientY])

      const { manhattanRenderState, renderBlocks, manhattanRpcDataMap } = model
      if (!manhattanRenderState) {
        return
      }
      const refNames = new Map(
        view.visibleRegions.map(r => [r.displayedRegionIndex, r.refName]),
      )
      model.setManhattanFeatureUnderMouse(
        findManhattanHit(
          event.clientX - rect.left,
          event.clientY - rect.top - YSCALEBAR_LABEL_OFFSET,
          renderBlocks,
          manhattanRpcDataMap,
          manhattanRenderState,
          refNames,
        ),
      )
    },
    [model, view],
  )

  const handleMouseLeave = useCallback(() => {
    model.setManhattanFeatureUnderMouse(undefined)
  }, [model])

  const width = view.trackWidthPx
  const height = model.height

  if (error) {
    return (
      <ErrorOverlay
        error={error}
        width={width}
        height={height}
        onRetry={() => {
          retry()
        }}
      />
    )
  }

  return (
    <div
      data-testid={model.canvasDrawn ? 'manhattan-gpu-done' : 'manhattan-gpu'}
      style={{ position: 'relative', width, height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', left: 0, top: YSCALEBAR_LABEL_OFFSET }}
      />
      <TooltipComponent model={model} clientMouseCoord={clientMouseCoord} />
    </div>
  )
})

export default LinearManhattanDisplayComponent
