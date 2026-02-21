import { useCallback, useEffect, useRef, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import LoadingOverlay from '../../shared/LoadingOverlay.tsx'
import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import YScaleBar from '../../shared/YScaleBar.tsx'
import { parseColor } from '../../shared/webglUtils.ts'

import type {
  WiggleGPURenderState,
  WiggleRenderBlock,
  SourceRenderData,
} from '../../shared/WiggleRenderer.ts'
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

function makeRenderState(
  model: WiggleDisplayModel,
  width: number,
): WiggleGPURenderState {
  return {
    domainY: model.domain!,
    scaleType: model.scaleType === 'log' ? 1 : 0,
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
  const useBicolor = model.color === '#f0f' || model.color === '#ff00ff'
  const baseColor = parseColor(model.color)
  const posColor = parseColor(model.posColor)
  const negColor = parseColor(model.negColor)
  const { bicolorPivot } = model

  if (!useBicolor) {
    const color =
      model.renderingType === 'density' ? posColor : baseColor
    return [
      {
        featurePositions: data.featurePositions,
        featureScores: data.featureScores,
        numFeatures: data.numFeatures,
        color,
      },
    ]
  }

  const posFeaturePositions: number[] = []
  const posFeatureScores: number[] = []
  const negFeaturePositions: number[] = []
  const negFeatureScores: number[] = []

  for (let i = 0; i < data.numFeatures; i++) {
    const score = data.featureScores[i]!
    const start = data.featurePositions[i * 2]!
    const end = data.featurePositions[i * 2 + 1]!
    if (score >= bicolorPivot) {
      posFeaturePositions.push(start, end)
      posFeatureScores.push(score)
    } else {
      negFeaturePositions.push(start, end)
      negFeatureScores.push(score)
    }
  }

  const sources: SourceRenderData[] = []
  if (posFeatureScores.length > 0) {
    sources.push({
      featurePositions: new Uint32Array(posFeaturePositions),
      featureScores: new Float32Array(posFeatureScores),
      numFeatures: posFeatureScores.length,
      color: posColor,
    })
  }
  if (negFeatureScores.length > 0) {
    sources.push({
      featurePositions: new Uint32Array(negFeaturePositions),
      featureScores: new Float32Array(negFeatureScores),
      numFeatures: negFeatureScores.length,
      color: negColor,
    })
  }
  return sources.length > 0
    ? sources
    : [
        {
          featurePositions: data.featurePositions,
          featureScores: data.featureScores,
          numFeatures: data.numFeatures,
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
  }, [model.rpcDataMap, model.color, model.posColor, model.negColor, model.bicolorPivot, ready])

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
      <LoadingOverlay statusMessage="Loading" isVisible={model.isLoading} />
    </div>
  )
})

export default WebGLWiggleComponent
