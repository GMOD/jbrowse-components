import { useCallback, useEffect, useRef, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  measureText,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import YScaleBar from '../../shared/YScaleBar.tsx'
import { parseColor } from '../../shared/webglUtils.ts'
import { useWebGLViewInteraction } from '../../LinearWebGLWiggleDisplay/components/useWebGLViewInteraction.ts'
import { WebGLMultiWiggleRenderer } from './WebGLMultiWiggleRenderer.ts'

import type {
  MultiRenderingType,
  SourceRenderData,
} from './WebGLMultiWiggleRenderer.ts'
import type { LinearWebGLMultiWiggleDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const ROW_PADDING = 2

// Compact score legend for when rows are too small for full scalebars
const ScoreLegend = observer(function ScoreLegend({
  model,
  canvasWidth,
}: {
  model: LinearWebGLMultiWiggleDisplayModel
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
      <rect x={xpos - 3} y={0} width={len + 6} height={16} fill="rgba(255,255,255,0.8)" />
      <text y={12} x={xpos} fontSize={12}>
        {legend}
      </text>
    </>
  )
})

const WebGLMultiWiggleComponent = observer(function WebGLMultiWiggleComponent({
  model,
}: {
  model: LinearWebGLMultiWiggleDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLMultiWiggleRenderer | null>(null)
  const rafRef = useRef<number>()
  const [error, setError] = useState<string | null>(null)

  const view = getContainingView(model) as LGV

  // Initialize WebGL renderer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    try {
      rendererRef.current = new WebGLMultiWiggleRenderer(canvas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'WebGL initialization failed')
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [])

  // Upload data when rpcData changes
  useEffect(() => {
    const renderer = rendererRef.current
    const data = model.rpcData
    if (!renderer || !data) {
      return
    }

    const sourcesData: SourceRenderData[] = data.sources.map(source => ({
      featurePositions: source.featurePositions,
      featureScores: source.featureScores,
      numFeatures: source.numFeatures,
      color: parseColor(source.color),
    }))

    renderer.uploadFromSources(data.regionStart, sourcesData)
  }, [model.rpcData])

  // Render with explicit domain (for immediate rendering during interaction)
  const renderWithDomain = useCallback(
    (domainX: [number, number]) => {
      const renderer = rendererRef.current
      if (!renderer) {
        return
      }
      const domain = model.domain
      if (!domain) {
        return
      }
      const totalWidth = Math.round(view.dynamicBlocks.totalWidthPx)
      const height = model.height

      renderer.render({
        domainX,
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

    const visibleRegion = model.visibleRegion
    if (!visibleRegion) {
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

    const totalWidth = Math.round(view.dynamicBlocks.totalWidthPx)
    const height = model.height

    // Use RAF for smooth rendering but only render once per state change
    rafRef.current = requestAnimationFrame(() => {
      renderer.render({
        domainX: [visibleRegion.start, visibleRegion.end],
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
    model.rpcData,
    model.height,
    model.scaleType,
    model.renderingType,
    model.visibleRegion,
    model.domain,
    view.initialized,
    view.dynamicBlocks.totalWidthPx,
  ])

  const totalWidth = Math.round(view.dynamicBlocks.totalWidthPx)
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

  // Calculate label width based on source names
  const labelWidth = model.rpcData
    ? Math.max(...model.rpcData.sources.map(s => measureText(s.name, 10))) + 10
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
        {model.rpcData && model.rpcData.sources.length > 1 ? (
          <>
            {model.rpcData.sources.map((source, idx) => {
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

      {model.isLoading ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.7)',
          }}
        >
          Loading...
        </div>
      ) : null}
    </div>
  )
})

export default WebGLMultiWiggleComponent
