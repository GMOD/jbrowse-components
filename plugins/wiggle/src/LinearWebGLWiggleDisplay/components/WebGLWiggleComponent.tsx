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
import LoadingOverlay from '../../shared/LoadingOverlay.tsx'
import YScaleBar from '../../shared/YScaleBar.tsx'
import { parseColor } from '../../shared/webglUtils.ts'

import type { RenderingType, WiggleRenderBlock } from './WebGLWiggleRenderer.ts'
import type { WebGLWiggleDataResult } from '../../RenderWebGLWiggleDataRPC/types.ts'
import type axisPropsFromTickScale from '../../shared/axisPropsFromTickScale.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export interface WiggleDisplayModel {
  rpcData: WebGLWiggleDataResult | null
  rpcDataMap: Map<number, WebGLWiggleDataResult>
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
  color: string
  posColor: string
  negColor: string
  bicolorPivot: number
  renderingType: string
  ticks?: ReturnType<typeof axisPropsFromTickScale>
  error: Error | null
  isLoading: boolean
}

const WebGLWiggleComponent = observer(function WebGLWiggleComponent({
  model,
}: {
  model: WiggleDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLWiggleRenderer | null>(null)
  const rafRef = useRef<number | undefined>(undefined)
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
      renderer.uploadForRegion(regionNumber, {
        regionStart: data.regionStart,
        featurePositions: data.featurePositions,
        featureScores: data.featureScores,
        numFeatures: data.numFeatures,
      })
    }
    renderer.pruneStaleRegions(activeRegions)
  }, [model.rpcDataMap])

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
      const width = Math.round(view.width)
      const height = model.height
      const useBicolor = model.color === '#f0f' || model.color === '#ff00ff'

      renderer.render({
        bpRangeX,
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

    const width = Math.round(view.width)
    const height = model.height

    const useBicolor = model.color === '#f0f' || model.color === '#ff00ff'

    // Build blocks from visibleRegions
    const blocks: WiggleRenderBlock[] = []
    for (const vr of visibleRegions) {
      blocks.push({
        regionNumber: vr.regionNumber,
        bpRangeX: [vr.start, vr.end],
        screenStartPx: vr.screenStartPx,
        screenEndPx: vr.screenEndPx,
      })
    }

    // Set canvas size
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    rafRef.current = requestAnimationFrame(() => {
      renderer.renderBlocks(blocks, {
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
    model.rpcDataMap,
    model.height,
    model.color,
    model.scaleType,
    model.renderingType,
    view.visibleRegions,
    model.domain,
    view.initialized,
    view.width,
    view.offsetPx,
    view.bpPerPx,
  ])

  const width = Math.round(view.width)
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
      <LoadingOverlay statusMessage="Loading" isVisible={model.isLoading} />
    </div>
  )
})

export default WebGLWiggleComponent
