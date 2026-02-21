import { useCallback, useEffect, useRef, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
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
import { WIGGLE_COLOR_DEFAULT } from '../../util.ts'

import type { WebGLWiggleDataResult } from '../../RenderWebGLWiggleDataRPC/types.ts'
import type {
  SourceRenderData,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from '../../shared/WiggleRenderer.ts'
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
  renderingType: string
  ticks?: ReturnType<typeof axisPropsFromTickScale>
  error: Error | null
  isLoading: boolean
  statusMessage?: string
  scalebarOverlapLeft: number
}

function renderingTypeToInt(type: string) {
  if (type === 'density') {
    return RENDERING_TYPE_DENSITY
  }
  if (type === 'line') {
    return RENDERING_TYPE_LINE
  }
  return RENDERING_TYPE_XYPLOT
}

function makeRenderState(
  model: WiggleDisplayModel,
  width: number,
): WiggleGPURenderState {
  return {
    domainY: model.domain!,
    scaleType: model.scaleType === 'log' ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR,
    renderingType: renderingTypeToInt(model.renderingType),
    rowPadding: 0,
    canvasWidth: width,
    canvasHeight: model.height,
  }
}

function buildSourceRenderData(
  data: WebGLWiggleDataResult,
  model: WiggleDisplayModel,
): SourceRenderData[] {
  const useBicolor =
    model.color === WIGGLE_COLOR_DEFAULT || model.color === '#ff00ff'
  const baseColor = parseColor(model.color)
  const posColor = parseColor(model.posColor)
  const negColor = parseColor(model.negColor)

  if (!useBicolor) {
    const color = model.renderingType === 'density' ? posColor : baseColor
    return [
      {
        featurePositions: data.posFeaturePositions,
        featureScores: data.posFeatureScores,
        numFeatures: data.posNumFeatures,
        color,
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

const WebGLWiggleComponent = observer(function WebGLWiggleComponent({
  model,
}: {
  model: WiggleDisplayModel
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

    const activeRegions: number[] = []
    for (const [regionNumber, data] of dataMap) {
      activeRegions.push(regionNumber)
      const sources = buildSourceRenderData(data, model)
      renderer.uploadRegion(regionNumber, data.regionStart, sources)
    }
    renderer.pruneRegions(activeRegions)
  }, [model.rpcDataMap, model.color, model.posColor, model.negColor, ready])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready || !view.initialized || !model.domain) {
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

    renderer.renderBlocks(blocks, makeRenderState(model, width))
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
        Error: {error}
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
        }}
        width={width}
        height={height}
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
      <LoadingOverlay
        statusMessage={model.statusMessage || 'Loading'}
        isVisible={model.isLoading}
      />
    </div>
  )
})

export default WebGLWiggleComponent
