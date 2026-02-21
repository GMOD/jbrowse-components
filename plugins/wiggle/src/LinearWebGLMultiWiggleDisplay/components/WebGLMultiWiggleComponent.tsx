import { useCallback, useEffect, useRef, useState } from 'react'

import { getContainingView, measureText } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import LoadingOverlay from '../../shared/LoadingOverlay.tsx'
import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import YScaleBar from '../../shared/YScaleBar.tsx'
import { parseColor } from '../../shared/webglUtils.ts'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_XYPLOT,
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
} from '../../shared/wiggleShader.ts'

import type { WebGLMultiWiggleDataResult } from '../../RenderWebGLMultiWiggleDataRPC/types.ts'
import type {
  SourceRenderData,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from '../../shared/WiggleRenderer.ts'
import type axisPropsFromTickScale from '../../shared/axisPropsFromTickScale.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export interface MultiWiggleDisplayModel {
  rpcDataMap: Map<number, WebGLMultiWiggleDataResult>
  sources: { name: string; color?: string }[]
  height: number
  domain: [number, number] | undefined
  scaleType: string
  posColor: string
  negColor: string
  renderingType: string
  numSources: number
  rowHeightTooSmallForScalebar: boolean
  ticks?: ReturnType<typeof axisPropsFromTickScale>
  error: Error | null
  isLoading: boolean
  statusMessage?: string
  scalebarOverlapLeft: number
}

const ROW_PADDING = 2

function renderingTypeToInt(type: string) {
  if (type === 'multirowdensity') {
    return RENDERING_TYPE_DENSITY
  }
  if (type === 'multirowline') {
    return RENDERING_TYPE_LINE
  }
  return RENDERING_TYPE_XYPLOT
}

function makeRenderState(
  model: MultiWiggleDisplayModel,
  width: number,
): WiggleGPURenderState {
  return {
    domainY: model.domain!,
    scaleType: model.scaleType === 'log' ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR,
    renderingType: renderingTypeToInt(model.renderingType),
    rowPadding: ROW_PADDING,
    canvasWidth: width,
    canvasHeight: model.height,
  }
}

const ScoreLegend = observer(function ScoreLegend({
  model,
  canvasWidth,
}: {
  model: MultiWiggleDisplayModel
  canvasWidth: number
}) {
  const { ticks, scaleType } = model
  if (!ticks) {
    return null
  }
  const legend = `[${ticks.values[0]?.toFixed(0)}-${ticks.values[1]?.toFixed(0)}]${scaleType === 'log' ? ' (log)' : ''}`
  const len = measureText(legend, 12)
  const xpos = canvasWidth - len - 60
  return (
    <>
      <rect
        x={xpos - 3}
        y={0}
        width={len + 6}
        height={16}
        fill="rgba(255,255,255,0.8)"
      />
      <text y={12} x={xpos} fontSize={12}>
        {legend}
      </text>
    </>
  )
})

const WebGLMultiWiggleComponent = observer(function WebGLMultiWiggleComponent({
  model,
}: {
  model: MultiWiggleDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const rendererRef = useRef<WiggleRenderer | null>(null)
  const [ready, setReady] = useState(false)

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

    const dataMap = model.rpcDataMap
    if (dataMap.size === 0) {
      renderer.pruneRegions([])
      return
    }

    const modelSources = model.sources
    const posColor = parseColor(model.posColor)
    const negColor = parseColor(model.negColor)
    const activeRegions: number[] = []
    for (const [regionNumber, data] of dataMap) {
      activeRegions.push(regionNumber)
      const sourcesByName = Object.fromEntries(
        data.sources.map(s => [s.name, s]),
      )
      const orderedSources =
        modelSources.length > 0 ? modelSources : data.sources
      const sourcesData: SourceRenderData[] = []
      for (const [idx, orderedSource] of orderedSources.entries()) {
        const src = orderedSource
        const rpcSource = sourcesByName[src.name]
        if (!rpcSource) {
          continue
        }
        if (rpcSource.posNumFeatures > 0) {
          sourcesData.push({
            featurePositions: rpcSource.posFeaturePositions,
            featureScores: rpcSource.posFeatureScores,
            numFeatures: rpcSource.posNumFeatures,
            color: posColor,
            rowIndex: idx,
          })
        }
        if (rpcSource.negNumFeatures > 0) {
          sourcesData.push({
            featurePositions: rpcSource.negFeaturePositions,
            featureScores: rpcSource.negFeatureScores,
            numFeatures: rpcSource.negNumFeatures,
            color: negColor,
            rowIndex: idx,
          })
        }
      }

      renderer.uploadRegion(regionNumber, data.regionStart, sourcesData)
    }
    renderer.pruneRegions(activeRegions)
  }, [model.rpcDataMap, model.sources, model.posColor, model.negColor, ready])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready || !view.initialized || !model.domain) {
      return
    }

    const visibleRegions = view.visibleRegions
    if (visibleRegions.length === 0) {
      return
    }

    const totalWidth = Math.round(view.width)

    const blocks: WiggleRenderBlock[] = visibleRegions.map(vr => ({
      regionNumber: vr.regionNumber,
      bpRangeX: [vr.start, vr.end] as [number, number],
      screenStartPx: vr.screenStartPx,
      screenEndPx: vr.screenEndPx,
    }))

    renderer.renderBlocks(blocks, makeRenderState(model, totalWidth))
  }, [
    model,
    model.rpcDataMap,
    model.sources,
    model.height,
    model.posColor,
    model.negColor,
    model.scaleType,
    model.renderingType,
    view.visibleRegions,
    model.domain,
    view.initialized,
    view.width,
    view.offsetPx,
    view.bpPerPx,
    ready,
  ])

  const totalWidth = Math.round(view.width)
  const height = model.height
  const scalebarLeft = model.scalebarOverlapLeft

  if (error) {
    return (
      <div style={{ width: totalWidth, height, color: 'red', padding: 10 }}>
        Error: {error}
      </div>
    )
  }

  if (model.error) {
    return (
      <div style={{ width: totalWidth, height, color: 'red', padding: 10 }}>
        Error: {model.error.message}
      </div>
    )
  }

  const numSources = model.numSources
  const rowHeight =
    numSources > 0
      ? (height - ROW_PADDING * (numSources - 1)) / numSources
      : height

  const displaySources = model.sources
  const labelWidth =
    displaySources.length > 0
      ? Math.max(...displaySources.map(s => measureText(s.name, 10))) + 10
      : 0

  return (
    <div style={{ position: 'relative', width: totalWidth, height }}>
      <canvas
        ref={canvasRefCallback}
        style={{
          width: totalWidth,
          height,
          position: 'absolute',
          left: 0,
          top: 0,
        }}
        width={totalWidth}
        height={height}
      />

      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          height,
          width: totalWidth,
        }}
      >
        {displaySources.length > 1 ? (
          <>
            {displaySources.map((source, idx) => {
              const y = rowHeight * idx + (idx > 0 ? ROW_PADDING * idx : 0)
              const boxHeight = Math.min(20, rowHeight)
              return (
                <g key={source.name}>
                  <rect
                    x={0}
                    y={y}
                    width={labelWidth}
                    height={boxHeight}
                    fill="rgba(255,255,255,0.8)"
                  />
                  <text
                    x={4}
                    y={y + boxHeight / 2 + 3}
                    fontSize={10}
                    fill="black"
                  >
                    {source.name}
                  </text>
                </g>
              )
            })}
          </>
        ) : null}

        {model.ticks ? (
          <g transform={`translate(${scalebarLeft || 50} 0)`}>
            {model.rowHeightTooSmallForScalebar ? (
              <ScoreLegend model={model} canvasWidth={totalWidth} />
            ) : (
              Array.from({ length: numSources }).map((_, idx) => (
                <g
                  transform={`translate(0 ${rowHeight * idx + (idx > 0 ? ROW_PADDING * idx : 0)})`}
                  key={`scalebar-${idx}`}
                >
                  <YScaleBar model={model} />
                </g>
              ))
            )}
          </g>
        ) : null}
      </svg>

      <LoadingOverlay
        statusMessage={model.statusMessage || 'Loading'}
        isVisible={model.isLoading}
      />
    </div>
  )
})

export default WebGLMultiWiggleComponent
