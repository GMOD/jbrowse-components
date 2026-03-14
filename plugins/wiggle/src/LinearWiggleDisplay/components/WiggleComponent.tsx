import { useCallback, useEffect, useRef, useState } from 'react'

import { ErrorBar } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import WiggleTooltip from './WiggleTooltip.tsx'
import DensityLegend from '../../shared/DensityLegend.tsx'
import LoadingOverlay from '../../shared/LoadingOverlay.tsx'
import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import YScaleBar from '../../shared/YScaleBar.tsx'
import { parseColor } from '../../shared/webglUtils.ts'
import {
  isSummaryFeature,
  makeRenderState,
  makeWhiskersSourceData,
} from '../../shared/wiggleComponentUtils.ts'
import { WIGGLE_COLOR_DEFAULT, getEffectiveScores } from '../../util.ts'

import type { WiggleDataResult } from '../../RenderWiggleDataRPC/types.ts'
import type {
  SourceRenderData,
  WiggleRenderBlock,
} from '../../shared/WiggleRenderer.ts'
import type axisPropsFromTickScale from '../../shared/axisPropsFromTickScale.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export interface WiggleDisplayModel {
  rpcDataMap: Map<number, WiggleDataResult>
  dataVersion: number
  height: number
  domain: [number, number] | undefined
  scaleType: string
  color: string
  posColor: string
  negColor: string
  renderingType: string
  isDensityMode: boolean
  summaryScoreMode: string
  ticks?: ReturnType<typeof axisPropsFromTickScale>
  error: Error | null
  isLoading: boolean
  statusMessage?: string
  scalebarOverlapLeft: number
  featureUnderMouse?: {
    refName: string
    start: number
    end: number
    score: number
    minScore?: number
    maxScore?: number
    summary?: boolean
  }
  setFeatureUnderMouse: (feat?: WiggleDisplayModel['featureUnderMouse']) => void
  reload: () => void
}

export function buildSourceRenderData(
  data: WiggleDataResult,
  model: WiggleDisplayModel,
): SourceRenderData[] {
  const useBicolor =
    model.color === WIGGLE_COLOR_DEFAULT || model.color === '#ff00ff'
  const baseColor = parseColor(model.color)
  const posColor = parseColor(model.posColor)
  const negColor = parseColor(model.negColor)
  const { summaryScoreMode } = model

  if (summaryScoreMode === 'whiskers') {
    const color = useBicolor ? posColor : baseColor
    const isScatter = model.renderingType === 'scatter'
    return makeWhiskersSourceData(
      data,
      color,
      model.isDensityMode,
      isScatter,
      0,
    )
  }

  const scores = getEffectiveScores(data, summaryScoreMode)

  if (!useBicolor) {
    const color = model.isDensityMode ? posColor : baseColor
    return [
      {
        featurePositions: data.featurePositions,
        featureScores: scores,
        numFeatures: data.numFeatures,
        color,
      },
    ]
  }

  if (summaryScoreMode === 'min' || summaryScoreMode === 'max') {
    return [
      {
        featurePositions: data.featurePositions,
        featureScores: scores,
        numFeatures: data.numFeatures,
        color: posColor,
        rowIndex: 0,
      },
    ]
  }

  const sources: SourceRenderData[] = []
  if (data.posNumFeatures > 0) {
    sources.push({
      featurePositions: data.posFeaturePositions,
      featureScores: data.posFeatureScores,
      numFeatures: data.posNumFeatures,
      color: posColor,
      rowIndex: 0,
    })
  }
  if (data.negNumFeatures > 0) {
    sources.push({
      featurePositions: data.negFeaturePositions,
      featureScores: data.negFeatureScores,
      numFeatures: data.negNumFeatures,
      color: negColor,
      rowIndex: 0,
    })
  }
  return sources.length > 0
    ? sources
    : [
        {
          featurePositions: data.posFeaturePositions,
          featureScores: data.posFeatureScores,
          numFeatures: data.posNumFeatures,
          color: baseColor,
        },
      ]
}

const WiggleComponent = observer(function WiggleComponent({
  model,
}: {
  model: WiggleDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const rendererRef = useRef<WiggleRenderer | null>(null)
  const [ready, setReady] = useState(false)
  const [drawn, setDrawn] = useState(false)

  const view = getContainingView(model) as LGV

  const canvasRefCallback = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) {
      return
    }
    canvasRef.current = canvas
    const renderer = WiggleRenderer.getOrCreate(canvas)
    rendererRef.current = renderer
    renderer
      .init()
      .then(ok => {
        if (!ok) {
          setError('GPU initialization failed')
        } else {
          setReady(true)
        }
      })
      .catch((e: unknown) => {
        setError(`GPU initialization error: ${e}`)
      })
  }, [])

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
  }, [model, ready])

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
  }, [model, view, ready, drawn])

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
      const bp = Math.round(region.start + frac * (region.end - region.start))
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

  if (error) {
    return (
      <div style={{ width, height, color: 'red', padding: 10 }}>
        Error: {error}
      </div>
    )
  }

  if (model.error) {
    return (
      <div style={{ position: 'relative', width, height }}>
        <ErrorBar
          error={`${model.error}`}
          onRetry={() => {
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
          ref={canvasRefCallback}
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
