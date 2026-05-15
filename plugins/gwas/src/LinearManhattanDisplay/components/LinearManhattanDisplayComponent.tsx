import { useCallback, useState } from 'react'

import { ErrorOverlay } from '@jbrowse/core/ui'
import { SimpleFeature, getContainingView } from '@jbrowse/core/util'
import { useGpuModelLifecycle } from '@jbrowse/core/util/useGpuModelLifecycle'
import { YSCALEBAR_LABEL_OFFSET, YScaleBar } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import { ManhattanRenderer } from '../ManhattanRenderer.ts'
import { findManhattanHit } from '../findManhattanHit.ts'
import TooltipComponent from './TooltipComponent.tsx'

import type { ManhattanHit } from '../findManhattanHit.ts'
import type { Feature } from '@jbrowse/core/util'
import type { GpuLifecycleModel } from '@jbrowse/core/util/useGpuModelLifecycle'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type {
  WiggleBackend,
  WiggleDataResult,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from '@jbrowse/plugin-wiggle'
import type { YScaleTicks } from '@jbrowse/wiggle-core'
import type { ObservableMap } from 'mobx'

type LGV = LinearGenomeViewModel

// The wiggle-composed model supplies everything: rpcDataMap, renderState,
// renderBlocks, ticks, setFeatureUnderMouse. selectFeature comes from
// BaseLinearDisplay. We stash a ManhattanHit (with screenX/screenY) into
// featureUnderMouse — wiggle's volatile is plain JS so the extra fields
// survive the round-trip.
export interface ManhattanDisplayModel
  extends GpuLifecycleModel<WiggleBackend> {
  canvasDrawn: boolean
  height: number
  rpcDataMap: ObservableMap<number, WiggleDataResult>
  renderState: WiggleGPURenderState | undefined
  renderBlocks: WiggleRenderBlock[]
  ticks: YScaleTicks | undefined
  featureUnderMouse: ManhattanHit | undefined
  setFeatureUnderMouse: (hit: ManhattanHit | undefined) => void
  selectFeature: (feature: Feature) => void
}

const COORD0: [number, number] = [0, 0]

const LinearManhattanDisplayComponent = observer(function LinearManhattanDisplayComponent({
  model,
}: {
  model: ManhattanDisplayModel
}) {
  const { canvasRef, error, retry } = useGpuModelLifecycle(
    ManhattanRenderer,
    model,
  )
  const view = getContainingView(model) as LGV
  const [clientMouseCoord, setClientMouseCoord] = useState(COORD0)

  const hitTest = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const { renderState, renderBlocks, rpcDataMap } = model
      if (!renderState) {
        return undefined
      }
      const refNames = new Map(
        view.visibleRegions.map(r => [r.displayedRegionIndex, r.refName]),
      )
      return findManhattanHit(
        event.clientX - rect.left,
        event.clientY - rect.top - YSCALEBAR_LABEL_OFFSET,
        renderBlocks,
        rpcDataMap,
        renderState,
        refNames,
      )
    },
    [model, view],
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      setClientMouseCoord([event.clientX, event.clientY])
      model.setFeatureUnderMouse(hitTest(event))
    },
    [model, hitTest],
  )

  const handleMouseLeave = useCallback(() => {
    model.setFeatureUnderMouse(undefined)
  }, [model])

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const hit = hitTest(event)
      if (hit) {
        model.selectFeature(
          new SimpleFeature({
            uniqueId: `manhattan-${hit.refName}-${hit.start}`,
            refName: hit.refName,
            start: hit.start,
            end: hit.end,
            score: hit.score,
          }),
        )
      }
    },
    [model, hitTest],
  )

  const width = view.trackWidthPx
  const height = model.height
  const { ticks, featureUnderMouse } = model

  return error ? (
    <ErrorOverlay
      error={error}
      width={width}
      height={height}
      onRetry={() => {
        retry()
      }}
    />
  ) : (
    <div
      data-testid={model.canvasDrawn ? 'manhattan-gpu-done' : 'manhattan-gpu'}
      style={{ position: 'relative', width, height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        style={{
          width,
          height: height - 2 * YSCALEBAR_LABEL_OFFSET,
          position: 'absolute',
          left: 0,
          top: YSCALEBAR_LABEL_OFFSET,
        }}
      />
      {ticks ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            height,
            width: 70,
          }}
        >
          <YScaleBar ticks={ticks} orientation="left" />
        </svg>
      ) : null}
      {featureUnderMouse?.screenX !== undefined ? (
        <svg
          style={{
            position: 'absolute',
            top: YSCALEBAR_LABEL_OFFSET,
            left: 0,
            pointerEvents: 'none',
            width,
            height: height - 2 * YSCALEBAR_LABEL_OFFSET,
          }}
        >
          <circle
            cx={featureUnderMouse.screenX}
            cy={featureUnderMouse.screenY}
            r={6}
            fill="none"
            stroke="black"
            strokeWidth={1.5}
          />
        </svg>
      ) : null}
      <TooltipComponent model={model} clientMouseCoord={clientMouseCoord} />
    </div>
  )
})

export default LinearManhattanDisplayComponent
