import { useCallback, useRef, useState } from 'react'

import { ErrorOverlay } from '@jbrowse/core/ui'
import { getContainingView, useGpuModelLifecycle } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import WiggleTooltip from './WiggleTooltip.tsx'
import DensityLegend from '../../shared/DensityLegend.tsx'
import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import {
  WiggleErrorBar,
  WiggleLoadingOverlay,
} from '../../shared/WiggleStatusOverlays.tsx'
import { YScaleBar } from '@jbrowse/wiggle-core'
import {
  findFeatureAtBp,
  hitTestMouse,
  isSummaryFeature,
} from '../../shared/wiggleComponentUtils.ts'

import type { WiggleDisplayModel } from './buildSourceRenderData.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const COORD0: [number, number] = [0, 0]

const WiggleComponent = observer(function WiggleComponent({
  model,
}: {
  model: WiggleDisplayModel
}) {
  // The model owns the upload/render autorun and the GPU backend lifecycle —
  // see startGpuBackendLifecycle / stopGpuBackendLifecycle / renderNow on the
  // LinearWiggleDisplay model. This component is just a thin bridge that
  // plugs the canvas and the backend into those model actions.
  const { canvasRef, error, retry } = useGpuModelLifecycle(
    WiggleRenderer,
    model,
  )

  const view = getContainingView(model) as LGV

  const [offsetMouseCoord, setOffsetMouseCoord] = useState(COORD0)
  const [clientMouseCoord, setClientMouseCoord] = useState(COORD0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const container = containerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        const offsetX = event.clientX - rect.left
        setOffsetMouseCoord([offsetX, event.clientY - rect.top])
        setClientMouseCoord([event.clientX, event.clientY])

        const { rpcDataMap, summaryScoreMode } = model
        const hit = hitTestMouse(view.visibleRegions, rpcDataMap, offsetX)
        if (!hit) {
          model.setFeatureUnderMouse(undefined)
        } else {
          const { region, data, bp } = hit
          const { featurePositions, featureScores, numFeatures } = data
          const foundIdx = findFeatureAtBp(featurePositions, numFeatures, bp)
          if (foundIdx === -1) {
            model.setFeatureUnderMouse(undefined)
          } else {
            const score = featureScores[foundIdx]!
            const minScore = data.featureMinScores[foundIdx]
            const maxScore = data.featureMaxScores[foundIdx]
            model.setFeatureUnderMouse({
              refName: region.refName,
              start: featurePositions[foundIdx * 2]!,
              end: featurePositions[foundIdx * 2 + 1]!,
              score,
              ...(summaryScoreMode !== 'avg' &&
              isSummaryFeature(score, minScore, maxScore)
                ? { summary: true, minScore, maxScore }
                : {}),
            })
          }
        }
      }
    },
    [model, view],
  )

  const handleMouseLeave = useCallback(() => {
    model.setFeatureUnderMouse(undefined)
  }, [model])

  const width = view.trackWidthPx
  const height = model.height
  const scalebarLeft = model.scalebarOverlapLeft

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
      ref={containerRef}
      data-testid={model.canvasDrawn ? 'wiggle-display-done' : 'wiggle-display'}
      style={{ position: 'relative', width, height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div>
        <canvas
          ref={canvasRef}
          style={{
            width,
            height,
            position: 'absolute',
            left: 0,
            top: 0,
          }}
        />
      </div>
      {model.isDensityMode && model.domain ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            height: 16,
            width,
          }}
        >
          <DensityLegend
            domain={model.domain}
            scaleType={model.scaleType}
            canvasWidth={width}
          />
        </svg>
      ) : model.ticks ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: scalebarLeft || 50,
            pointerEvents: 'none',
            height,
            width: 50,
          }}
        >
          <YScaleBar ticks={model.ticks} orientation="left" />
        </svg>
      ) : null}
      {model.displayCrossHatches && model.ticks ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            height,
            width,
          }}
        >
          {model.ticks.ticks.map(({ value, y }) => (
            <line
              key={value}
              x1={0}
              x2={width}
              y1={y}
              y2={y}
              stroke="rgba(200,200,200,0.8)"
              strokeWidth={1}
            />
          ))}
        </svg>
      ) : null}
      <WiggleTooltip
        model={model}
        clientMouseCoord={clientMouseCoord}
        offsetMouseCoord={offsetMouseCoord}
        height={height}
      />
      <WiggleErrorBar model={model} />
      <WiggleLoadingOverlay model={model} />
    </div>
  )
})

export default WiggleComponent

export type { WiggleDisplayModel } from './buildSourceRenderData.ts'
