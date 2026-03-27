import { useCallback, useEffect, useRef, useState } from 'react'

import { ErrorBar } from '@jbrowse/core/ui'
import { getContainingView, useGpuRenderer } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import WiggleTooltip from './WiggleTooltip.tsx'
import { buildSourceRenderData } from './buildSourceRenderData.ts'
import DensityLegend from '../../shared/DensityLegend.tsx'
import LoadingOverlay from '../../shared/LoadingOverlay.tsx'
import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import YScaleBar from '../../shared/YScaleBar.tsx'
import {
  isSummaryFeature,
  makeRenderState,
} from '../../shared/wiggleComponentUtils.ts'

import type { WiggleRenderBlock } from '../../shared/wiggleBackendTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export type { WiggleDisplayModel } from './buildSourceRenderData.ts'

type LGV = LinearGenomeViewModel

const WiggleComponent = observer(function WiggleComponent({
  model,
}: {
  model: WiggleDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawn, setDrawn] = useState(false)

  const { error, ready, rendererRef, retry } = useGpuRenderer(
    canvasRef,
    WiggleRenderer,
  )

  const view = getContainingView(model) as LGV

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready) {
      return
    }

    return autorun(() => {
      const dataMap = model.rpcDataMap
      if (dataMap.size === 0) {
        renderer.pruneRegions([])
        return
      }

      const activeRegions: number[] = []
      for (const [regionNumber, data] of dataMap) {
        activeRegions.push(regionNumber)
        const sources = buildSourceRenderData(data, model)
        renderer.uploadRegion(regionNumber, data.regionStart, sources)
      }
      renderer.pruneRegions(activeRegions)
    })
  }, [model, ready, rendererRef])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready) {
      return
    }

    return autorun(() => {
      if (!view.initialized) {
        return
      }

      // See dataVersion comment in MultiRegionDisplayMixin.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _dv = model.dataVersion

      const { domain } = model
      const visibleRegions = view.visibleRegions
      const width = view.trackWidthPx

      if (!domain || visibleRegions.length === 0) {
        renderer.renderBlocks(
          [],
          makeRenderState([0, 1], 'linear', 'xyplot', width, model.height),
        )
        return
      }

      const blocks: WiggleRenderBlock[] = visibleRegions.map(vr => ({
        regionNumber: vr.regionNumber,
        bpRangeX: [vr.start, vr.end] as [number, number],
        screenStartPx: vr.screenStartPx,
        screenEndPx: vr.screenEndPx,
        reversed: vr.reversed ?? false,
      }))

      renderer.renderBlocks(
        blocks,
        makeRenderState(
          domain,
          model.scaleType,
          model.renderingType,
          width,
          model.height,
        ),
      )
      if (!drawn) {
        setDrawn(true)
      }
    })
  }, [model, view, ready, drawn, rendererRef])

  const [offsetMouseCoord, setOffsetMouseCoord] = useState<[number, number]>([
    0, 0,
  ])
  const [clientMouseCoord, setClientMouseCoord] = useState<[number, number]>([
    0, 0,
  ])
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const container = containerRef.current
      if (!container) {
        return
      }
      const rect = container.getBoundingClientRect()
      const offsetX = event.clientX - rect.left
      setOffsetMouseCoord([offsetX, event.clientY - rect.top])
      setClientMouseCoord([event.clientX, event.clientY])

      const { rpcDataMap, summaryScoreMode } = model
      if (rpcDataMap.size === 0) {
        model.setFeatureUnderMouse(undefined)
        return
      }

      const visibleRegions = view.visibleRegions
      const region = visibleRegions.find(
        r => offsetX >= r.screenStartPx && offsetX < r.screenEndPx,
      )
      if (!region) {
        model.setFeatureUnderMouse(undefined)
        return
      }

      const data = rpcDataMap.get(region.regionNumber)
      if (!data) {
        model.setFeatureUnderMouse(undefined)
        return
      }

      const blockWidth = region.screenEndPx - region.screenStartPx
      const frac = (offsetX - region.screenStartPx) / blockWidth
      const bp = region.reversed
        ? Math.round(region.end - frac * (region.end - region.start))
        : Math.round(region.start + frac * (region.end - region.start))
      const bpOffset = bp - data.regionStart

      const { featurePositions, featureScores, numFeatures } = data
      let foundIdx = -1
      for (let i = 0; i < numFeatures; i++) {
        const fStart = featurePositions[i * 2]!
        const fEnd = featurePositions[i * 2 + 1]!
        if (bpOffset >= fStart && bpOffset < fEnd) {
          foundIdx = i
          break
        }
      }

      if (foundIdx === -1) {
        model.setFeatureUnderMouse(undefined)
        return
      }

      const fStart = featurePositions[foundIdx * 2]! + data.regionStart
      const fEnd = featurePositions[foundIdx * 2 + 1]! + data.regionStart
      const score = featureScores[foundIdx]!
      const minScore = data.featureMinScores[foundIdx]
      const maxScore = data.featureMaxScores[foundIdx]

      model.setFeatureUnderMouse({
        refName: region.refName,
        start: fStart,
        end: fEnd,
        score,
        ...(summaryScoreMode !== 'avg' &&
        isSummaryFeature(score, minScore, maxScore)
          ? { summary: true, minScore, maxScore }
          : {}),
      })
    },
    [model, view],
  )

  const handleMouseLeave = useCallback(() => {
    model.setFeatureUnderMouse(undefined)
  }, [model])

  const width = view.trackWidthPx
  const height = model.height
  const scalebarLeft = model.scalebarOverlapLeft

  if (error || model.error) {
    return (
      <div style={{ position: 'relative', width, height }}>
        <ErrorBar
          error={error ?? model.error}
          onRetry={() => {
            retry()
            setDrawn(false)
            model.reload()
          }}
        />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      data-testid="wiggle-display"
      style={{ position: 'relative', width, height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div data-testid={`drawn-${drawn}`}>
        <canvas
          ref={canvasRef}
          style={{
            width,
            height,
            position: 'absolute',
            left: 0,
            top: 0,
          }}
          width={width}
          height={height}
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
          <YScaleBar model={model} />
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
          {model.ticks.values.map((v, idx) => {
            const pos = model.ticks!.position(v)
            if (!Number.isFinite(pos)) {
              return null
            }
            return (
              <line
                key={idx}
                x1={0}
                x2={width}
                y1={pos}
                y2={pos}
                stroke="rgba(200,200,200,0.8)"
                strokeWidth={1}
              />
            )
          })}
        </svg>
      ) : null}
      <WiggleTooltip
        model={model}
        clientMouseCoord={clientMouseCoord}
        offsetMouseCoord={offsetMouseCoord}
        height={height}
      />
      <LoadingOverlay
        statusMessage={model.statusMessage || 'Loading'}
        isVisible={model.isLoading}
      />
    </div>
  )
})

export default WiggleComponent
