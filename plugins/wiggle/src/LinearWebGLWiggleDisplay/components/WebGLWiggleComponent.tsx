import { useCallback, useEffect, useRef, useState } from 'react'

import { getContainingView, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { WiggleWebGPUProxy } from './WiggleWebGPUProxy.ts'
import { useWebGLViewInteraction } from './useWebGLViewInteraction.ts'
import LoadingOverlay from '../../shared/LoadingOverlay.tsx'
import YScaleBar from '../../shared/YScaleBar.tsx'
import { parseColor } from '../../shared/webglUtils.ts'

import type { WiggleGPURenderState } from './WiggleWebGPUProxy.ts'
import type { WiggleRenderBlock } from './WebGLWiggleRenderer.ts'
import type { WebGLWiggleDataResult } from '../../RenderWebGLWiggleDataRPC/types.ts'
import type axisPropsFromTickScale from '../../shared/axisPropsFromTickScale.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export interface WiggleDisplayModel {
  rpcDataMap: Map<number, WebGLWiggleDataResult>
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
  scalebarOverlapLeft: number
}

function renderingTypeToInt(type: string) {
  if (type === 'density') {
    return 1
  }
  if (type === 'line') {
    return 2
  }
  return 0
}

function makeRenderState(model: WiggleDisplayModel, width: number): WiggleGPURenderState {
  const useBicolor = model.color === '#f0f' || model.color === '#ff00ff'
  return {
    domainY: model.domain!,
    scaleType: model.scaleType === 'log' ? 1 : 0,
    renderingType: renderingTypeToInt(model.renderingType),
    useBicolor: useBicolor ? 1 : 0,
    bicolorPivot: model.bicolorPivot,
    color: parseColor(model.color),
    posColor: parseColor(model.posColor),
    negColor: parseColor(model.negColor),
    canvasWidth: width,
    canvasHeight: model.height,
  }
}

const WebGLWiggleComponent = observer(function WebGLWiggleComponent({
  model,
}: {
  model: WiggleDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const proxyRef = useRef<WiggleWebGPUProxy | null>(null)
  const [ready, setReady] = useState(false)

  const view = getContainingView(model) as LGV

  const canvasRefCallback = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) {
      return
    }
    canvasRef.current = canvas
    const { rpcManager } = getSession(model)
    const proxy = WiggleWebGPUProxy.getOrCreate(canvas, rpcManager)
    proxyRef.current = proxy
    proxy.init(canvas).then(ok => {
      if (!ok) {
        setError('WebGPU initialization failed')
      } else {
        setReady(true)
      }
    })
  }, [])

  useEffect(() => {
    const proxy = proxyRef.current
    if (!proxy || !ready) {
      return
    }

    const dataMap = model.rpcDataMap
    if (dataMap.size === 0) {
      proxy.pruneRegions([])
      return
    }

    const activeRegions: number[] = []
    for (const [regionNumber, data] of dataMap) {
      activeRegions.push(regionNumber)
      proxy.uploadRegion(regionNumber, {
        regionStart: data.regionStart,
        featurePositions: data.featurePositions,
        featureScores: data.featureScores,
        numFeatures: data.numFeatures,
      })
    }
    proxy.pruneRegions(activeRegions)
  }, [model.rpcDataMap, ready])

  const renderWithDomain = useCallback(
    (bpRangeX: [number, number]) => {
      const proxy = proxyRef.current
      if (!proxy || !ready || !model.domain) {
        return
      }
      const width = Math.round(view.width)
      proxy.renderSingle(bpRangeX, makeRenderState(model, width))
    },
    [model, view, ready],
  )

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

  useEffect(() => {
    const proxy = proxyRef.current
    if (!proxy || !ready || !view.initialized || !model.domain) {
      return
    }

    const visibleRegions = view.visibleRegions
    if (visibleRegions.length === 0) {
      return
    }

    const width = Math.round(view.width)

    const blocks: WiggleRenderBlock[] = visibleRegions.map(vr => ({
      regionNumber: vr.regionNumber,
      bpRangeX: [vr.start, vr.end] as [number, number],
      screenStartPx: vr.screenStartPx,
      screenEndPx: vr.screenEndPx,
    }))

    requestAnimationFrame(() => {
      proxy.renderBlocks(blocks, makeRenderState(model, width))
    })
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
    ready,
  ])

  const width = Math.round(view.width)
  const height = model.height
  const scalebarLeft = model.scalebarOverlapLeft

  if (error) {
    return (
      <div style={{ width, height, color: 'red', padding: 10 }}>
        WebGPU Error: {error}
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
        ref={canvasRefCallback}
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
            left: scalebarLeft || 50,
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
