import { useCallback, useEffect, useRef, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  measureText,
  useWebGLRenderer,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { WebGLMultiWiggleRenderer } from './WebGLMultiWiggleRenderer.ts'
import { useWebGLViewInteraction } from '../../LinearWebGLWiggleDisplay/components/useWebGLViewInteraction.ts'
import LoadingOverlay from '../../shared/LoadingOverlay.tsx'
import YScaleBar from '../../shared/YScaleBar.tsx'
import { parseColor } from '../../shared/webglUtils.ts'

import type {
  MultiRenderingType,
  MultiWiggleRenderBlock,
  SourceRenderData,
} from './WebGLMultiWiggleRenderer.ts'
import type { WebGLMultiWiggleDataResult } from '../../RenderWebGLMultiWiggleDataRPC/types.ts'
import type axisPropsFromTickScale from '../../shared/axisPropsFromTickScale.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export interface MultiWiggleDisplayModel {
  rpcData: WebGLMultiWiggleDataResult | null
  rpcDataMap: Map<number, WebGLMultiWiggleDataResult>
  visibleRegion: { start: number; end: number } | null
  visibleRegions: {
    refName: string
    regionNumber: number
    start: number
    end: number
    assemblyName: string
    screenStartPx: number
    screenEndPx: number
  }[]
  height: number
  domain: [number, number] | undefined
  scaleType: string
  renderingType: string
  numSources: number
  rowHeightTooSmallForScalebar: boolean
  ticks?: ReturnType<typeof axisPropsFromTickScale>
  error: Error | null
  isLoading: boolean
}

const ROW_PADDING = 2

// Compact score legend for when rows are too small for full scalebars
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
  const rafRef = useRef<number | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const view = getContainingView(model) as LGV

  const { rendererRef, contextVersion } = useWebGLRenderer(
    canvasRef,
    canvas => new WebGLMultiWiggleRenderer(canvas),
    {
      onError: e => {
        setError(e instanceof Error ? e.message : 'WebGL initialization failed')
      },
    },
  )

  // Upload data when rpcDataMap changes
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) {
      return
    }

    const dataMap = model.rpcDataMap
    if (dataMap.size === 0) {
      renderer.clearAllBuffers()
      return
    }

    const activeRegions = new Set<number>()
    for (const [regionNumber, data] of dataMap) {
      activeRegions.add(regionNumber)
      const sourcesData: SourceRenderData[] = data.sources.map(source => ({
        featurePositions: source.featurePositions,
        featureScores: source.featureScores,
        numFeatures: source.numFeatures,
        color: parseColor(source.color),
      }))

      renderer.uploadForRegion(regionNumber, data.regionStart, sourcesData)
    }
    renderer.pruneStaleRegions(activeRegions)
  }, [model.rpcDataMap, contextVersion])

  // Render with explicit domain (for immediate rendering during interaction)
  const renderWithDomain = useCallback(
    (bpRangeX: [number, number]) => {
      const renderer = rendererRef.current
      if (!renderer) {
        return
      }
      const domain = model.domain
      if (!domain) {
        return
      }
      const totalWidth = Math.round(view.width)
      const height = model.height

      renderer.render({
        bpRangeX,
        domainY: domain,
        scaleType: model.scaleType as 'linear' | 'log',
        canvasWidth: totalWidth,
        canvasHeight: height,
        rowPadding: ROW_PADDING,
        renderingType: model.renderingType as MultiRenderingType,
      })
    },
    [model, view],
  )

  // Use the shared interaction hook for pan/zoom
  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    isDragging,
  } = useWebGLViewInteraction({
    canvasRef,
    view,
    onRender: renderWithDomain,
  })

  // Render when state changes (on-demand rendering instead of continuous loop)
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !view.initialized) {
      return
    }

    const visibleRegions = view.visibleRegions
    if (visibleRegions.length === 0) {
      return
    }

    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const domain = model.domain
    if (!domain) {
      return
    }

    const totalWidth = Math.round(view.width)
    const height = model.height

    // Build blocks from visibleRegions
    const blocks: MultiWiggleRenderBlock[] = []
    for (const vr of visibleRegions) {
      blocks.push({
        regionNumber: vr.regionNumber,
        bpRangeX: [vr.start, vr.end],
        screenStartPx: vr.screenStartPx,
        screenEndPx: vr.screenEndPx,
      })
    }

    // Set canvas size
    if (canvas.width !== totalWidth || canvas.height !== height) {
      canvas.width = totalWidth
      canvas.height = height
    }

    // Use RAF for smooth rendering but only render once per state change
    rafRef.current = requestAnimationFrame(() => {
      renderer.renderBlocks(blocks, {
        domainY: domain,
        scaleType: model.scaleType as 'linear' | 'log',
        canvasWidth: totalWidth,
        canvasHeight: height,
        rowPadding: ROW_PADDING,
        renderingType: model.renderingType as MultiRenderingType,
      })
    })

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [
    model,
    model.rpcDataMap,
    model.height,
    model.scaleType,
    model.renderingType,
    view.visibleRegions,
    model.domain,
    view.initialized,
    view.width,
    view.offsetPx,
    view.bpPerPx,
    contextVersion,
  ])

  const totalWidth = Math.round(view.width)
  const height = model.height
  const { trackLabels } = view
  const track = getContainingTrack(model)

  if (error) {
    return (
      <div style={{ width: totalWidth, height, color: 'red', padding: 10 }}>
        WebGL Error: {error}
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

  // Calculate label width based on source names from first region's data
  const firstData = model.rpcData
  const labelWidth = firstData
    ? Math.max(...firstData.sources.map(s => measureText(s.name, 10))) + 10
    : 0

  return (
    <div style={{ position: 'relative', width: totalWidth, height }}>
      {/* Canvas spans full width */}
      <canvas
        ref={canvasRef}
        style={{
          width: totalWidth,
          height,
          position: 'absolute',
          left: 0,
          top: 0,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        width={totalWidth}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />

      {/* SVG overlay for labels and scalebars */}
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
        {/* Source labels with semi-transparent background */}
        {firstData && firstData.sources.length > 1 ? (
          <>
            {firstData.sources.map((source, idx) => {
              const y = rowHeight * idx + (idx > 0 ? ROW_PADDING * idx : 0)
              const boxHeight = Math.min(20, rowHeight)
              return (
                <g key={source.name}>
                  {/* Semi-transparent background */}
                  <rect
                    x={0}
                    y={y}
                    width={labelWidth}
                    height={boxHeight}
                    fill="rgba(255,255,255,0.8)"
                  />
                  {/* Label text */}
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

        {/* Y scalebars */}
        {model.ticks ? (
          <g
            transform={`translate(${
              trackLabels === 'overlapping'
                ? measureText(getConf(track, 'name'), 12.8) + 50
                : 50
            } 0)`}
          >
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

      <LoadingOverlay statusMessage="Loading" isVisible={model.isLoading} />
    </div>
  )
})

export default WebGLMultiWiggleComponent
