import { useCallback, useEffect, useRef, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  measureText,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { WebGLWiggleRenderer } from './WebGLWiggleRenderer.ts'
import { useWebGLViewInteraction } from './useWebGLViewInteraction.ts'
import YScaleBar from '../../shared/YScaleBar.tsx'
import { parseColor } from '../../shared/webglUtils.ts'

import type { RenderingType } from './WebGLWiggleRenderer.ts'
import type { LinearWebGLWiggleDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const WebGLWiggleComponent = observer(function WebGLWiggleComponent({
  model,
}: {
  model: LinearWebGLWiggleDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLWiggleRenderer | null>(null)
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
      rendererRef.current = new WebGLWiggleRenderer(canvas)
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

    renderer.uploadFromTypedArrays({
      regionStart: data.regionStart,
      featurePositions: data.featurePositions,
      featureScores: data.featureScores,
      numFeatures: data.numFeatures,
    })
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
      const width = Math.round(view.dynamicBlocks.totalWidthPx)
      const height = model.height
      const useBicolor = model.color === '#f0f' || model.color === '#ff00ff'

      renderer.render({
        domainX,
        domainY: domain,
        scaleType: model.scaleType as 'linear' | 'log',
        color: parseColor(model.color),
        posColor: parseColor(model.posColor),
        negColor: parseColor(model.negColor),
        bicolorPivot: model.bicolorPivot,
        useBicolor,
        canvasWidth: width,
        canvasHeight: height,
        renderingType: model.renderingType as RenderingType,
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

    const width = Math.round(view.dynamicBlocks.totalWidthPx)
    const height = model.height

    // Check if we should use bicolor (default color is the magenta default)
    const useBicolor = model.color === '#f0f' || model.color === '#ff00ff'

    // Use RAF for smooth rendering but only render once per state change
    rafRef.current = requestAnimationFrame(() => {
      renderer.render({
        domainX: [visibleRegion.start, visibleRegion.end],
        domainY: domain,
        scaleType: model.scaleType as 'linear' | 'log',
        color: parseColor(model.color),
        posColor: parseColor(model.posColor),
        negColor: parseColor(model.negColor),
        bicolorPivot: model.bicolorPivot,
        useBicolor,
        canvasWidth: width,
        canvasHeight: height,
        renderingType: model.renderingType as RenderingType,
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
    model.color,
    model.scaleType,
    model.renderingType,
    model.visibleRegion,
    model.domain,
    view.initialized,
    view.dynamicBlocks.totalWidthPx,
  ])

  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const height = model.height
  const { trackLabels } = view
  const track = getContainingTrack(model)

  if (error) {
    return (
      <div style={{ width, height, color: 'red', padding: 10 }}>
        WebGL Error: {error}
      </div>
    )
  }

  if (model.error) {
    return (
      <div style={{ width, height, color: 'red', padding: 10 }}>
        Error: {model.error.message}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        style={{
          width,
          height,
          position: 'absolute',
          left: 0,
          top: 0,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      {model.ticks ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left:
              trackLabels === 'overlapping'
                ? measureText(getConf(track, 'name'), 12.8) + 100
                : 50,
            pointerEvents: 'none',
            height,
            width: 50,
          }}
        >
          <YScaleBar model={model} />
        </svg>
      ) : null}
      {model.isLoading ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width,
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

export default WebGLWiggleComponent
