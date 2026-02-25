import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'

import DensityLegend from '../shared/DensityLegend.tsx'
import MultiRowLabels from '../shared/MultiRowLabels.tsx'
import OverlayColorLegend from '../shared/OverlayColorLegend.tsx'
import ScoreLegend from '../shared/ScoreLegend.tsx'
import YScaleBar from '../shared/YScaleBar.tsx'
import { getDensityColor } from '../shared/getDensityColor.ts'
import {
  getRowTop,
  renderingTypeToInt,
} from '../shared/wiggleComponentUtils.ts'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
} from '../shared/wiggleShader.ts'
import { getScale } from '../util.ts'

import type { MultiLinearWiggleDisplayModel } from './model.ts'
import type { MultiWiggleSourceData } from '../RenderMultiWiggleDataRPC/types.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface FeatureSlice {
  positions: Uint32Array
  scores: Float32Array
  numFeatures: number
  color: string
}

function getFeatureSlices(
  source: MultiWiggleSourceData,
  color: string,
  negColor: string,
  isOverlay: boolean,
) {
  const slices: FeatureSlice[] = []
  if (source.posNumFeatures > 0) {
    slices.push({
      positions: source.posFeaturePositions,
      scores: source.posFeatureScores,
      numFeatures: source.posNumFeatures,
      color,
    })
  }
  if (source.negNumFeatures > 0) {
    slices.push({
      positions: source.negFeaturePositions,
      scores: source.negFeatureScores,
      numFeatures: source.negNumFeatures,
      color: isOverlay ? color : negColor,
    })
  }
  return slices
}

function renderFeatureSlice(
  ctx: CanvasRenderingContext2D | SvgCanvas,
  slice: FeatureSlice,
  regionStart: number,
  block: { start: number; end: number },
  blockScreenX: number,
  bpPerPx: number,
  renderType: number,
  scale: (v: number) => number,
  rowY: number,
  rowHeight: number,
  minScore: number,
  maxScore: number,
  scaleType: string,
) {
  const { positions, scores, numFeatures, color } = slice

  if (renderType === RENDERING_TYPE_LINE) {
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    let started = false
    for (let i = 0; i < numFeatures; i++) {
      const posIdx = i * 2
      const featureStart = regionStart + positions[posIdx]!
      const featureEnd = regionStart + positions[posIdx + 1]!
      const score = scores[i]!
      if (featureEnd < block.start || featureStart > block.end) {
        continue
      }
      const x = (featureStart - block.start) / bpPerPx + blockScreenX
      const xEnd = (featureEnd - block.start) / bpPerPx + blockScreenX
      const y = scale(score) + rowY
      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else {
        ctx.lineTo(x, y)
      }
      ctx.lineTo(xEnd, y)
    }
    ctx.stroke()
  } else {
    for (let i = 0; i < numFeatures; i++) {
      const posIdx = i * 2
      const featureStart = regionStart + positions[posIdx]!
      const featureEnd = regionStart + positions[posIdx + 1]!
      const score = scores[i]!
      if (featureEnd < block.start || featureStart > block.end) {
        continue
      }
      const x = (featureStart - block.start) / bpPerPx + blockScreenX
      const w = Math.max((featureEnd - featureStart) / bpPerPx, 1)

      if (renderType === RENDERING_TYPE_XYPLOT) {
        const y = scale(score) + rowY
        const originY = scale(0) + rowY
        const rectY = Math.min(y, originY)
        const rectHeight = Math.abs(originY - y) || 1
        ctx.fillStyle = color
        ctx.fillRect(x, rectY, w + 0.5, rectHeight)
      } else if (renderType === RENDERING_TYPE_SCATTER) {
        const y = scale(score) + rowY
        ctx.fillStyle = color
        ctx.fillRect(x, y - 1, w, 2)
      } else if (renderType === RENDERING_TYPE_DENSITY) {
        ctx.fillStyle = getDensityColor(
          score,
          minScore,
          maxScore,
          scaleType,
          color,
        )
        ctx.fillRect(x, rowY, w, rowHeight)
      }
    }
  }
}

function renderToCtx(
  ctx: CanvasRenderingContext2D | SvgCanvas,
  model: MultiLinearWiggleDisplayModel,
  view: LGV,
) {
  const { offsetPx, bpPerPx } = view
  const {
    renderingType,
    rpcDataMap,
    domain,
    scaleType,
    sources: modelSources,
    isOverlay,
    rowHeight,
    negColor,
  } = model

  if (!domain || modelSources.length === 0) {
    return
  }

  const [minScore, maxScore] = domain
  const renderType = renderingTypeToInt(renderingType)
  const overlay = isOverlay

  const scale = getScale({
    scaleType,
    domain,
    range: [rowHeight, 0],
    inverted: false,
  })

  for (const block of view.dynamicBlocks.contentBlocks) {
    if (block.regionNumber === undefined) {
      continue
    }
    const data = rpcDataMap.get(block.regionNumber)
    if (!data) {
      continue
    }
    const blockScreenX = block.offsetPx - offsetPx

    for (let sourceIdx = 0; sourceIdx < data.sources.length; sourceIdx++) {
      const source = data.sources[sourceIdx]!
      const modelSource = modelSources.find(s => s.name === source.name)
      const color = modelSource?.color ?? source.color
      const rowY = overlay ? 0 : getRowTop(sourceIdx, rowHeight)

      const slices = getFeatureSlices(source, color, negColor, overlay)
      for (const slice of slices) {
        renderFeatureSlice(
          ctx,
          slice,
          data.regionStart,
          block,
          blockScreenX,
          bpPerPx,
          renderType,
          scale,
          rowY,
          rowHeight,
          minScore,
          maxScore,
          scaleType,
        )
      }
    }
  }
}

export async function renderSvg(
  model: MultiLinearWiggleDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  const { offsetPx } = view
  const height = model.height
  const {
    ticks,
    rpcDataMap,
    domain,
    scaleType,
    numSources,
    isOverlay,
    rowHeight,
  } = model

  if (rpcDataMap.size === 0 || !domain || numSources === 0) {
    return null
  }

  const canvasWidth = Math.round(view.width)
  const tooSmallForScalebar = rowHeight < 70

  let legendEl: React.ReactNode = null
  if (model.isDensityMode) {
    legendEl = (
      <DensityLegend
        domain={domain}
        scaleType={scaleType}
        canvasWidth={canvasWidth}
      />
    )
  } else if (ticks) {
    if (tooSmallForScalebar) {
      legendEl = (
        <ScoreLegend
          ticks={ticks}
          scaleType={scaleType}
          canvasWidth={canvasWidth}
        />
      )
    } else if (isOverlay) {
      legendEl = (
        <g transform={`translate(${Math.max(-offsetPx, 0)} 0)`}>
          <YScaleBar
            model={model as unknown as { ticks: typeof ticks }}
            orientation="left"
          />
        </g>
      )
    } else {
      legendEl = (
        <g transform={`translate(${Math.max(-offsetPx, 0)} 0)`}>
          {Array.from({ length: numSources }).map((_, idx) => (
            <g
              transform={`translate(0 ${getRowTop(idx, rowHeight)})`}
              key={`scalebar-${idx}`}
            >
              <YScaleBar
                model={model as unknown as { ticks: typeof ticks }}
                orientation="left"
              />
            </g>
          ))}
        </g>
      )
    }
  }

  const sources = model.sources
  const { hierarchy, showTree, treeAreaWidth } = model
  const labelOffset = showTree && hierarchy ? treeAreaWidth : 0
  let labelsEl: React.ReactNode = null
  if (sources.length > 1) {
    if (isOverlay) {
      labelsEl = (
        <OverlayColorLegend
          sources={sources}
          fallbackColor={model.posColor}
          canvasWidth={canvasWidth}
        />
      )
    } else {
      labelsEl = (
        <MultiRowLabels
          sources={sources}
          rowHeight={rowHeight}
          labelOffset={labelOffset}
        />
      )
    }
  }

  let treeEl: React.ReactNode = null
  if (showTree && hierarchy) {
    let treePaths = ''
    for (const link of hierarchy.links()) {
      const sx = link.source.y!
      const sy = link.source.x!
      const tx = link.target.y!
      const ty = link.target.x!
      treePaths += `M${sx},${sy}L${sx},${ty}M${sx},${ty}L${tx},${ty}`
    }
    treeEl = <path d={treePaths} fill="none" stroke="#0008" strokeWidth={1} />
  }

  const totalWidth = view.dynamicBlocks.totalWidthPx
  const clipId = `wiggle-clip-${model.id}`

  if (opts?.rasterizeLayers) {
    const canvas =
      opts.createCanvas?.(totalWidth * 2, height * 2) ??
      document.createElement('canvas')
    canvas.width = totalWidth * 2
    canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return null
    }
    ctx.scale(2, 2)
    renderToCtx(ctx, model, view)
    return (
      <>
        <image
          width={totalWidth}
          height={height}
          xlinkHref={canvas.toDataURL('image/png')}
        />
        {labelsEl}
        {legendEl}
        {treeEl}
      </>
    )
  }

  const ctx = new SvgCanvas()
  renderToCtx(ctx, model, view)

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={view.width} height={height} />
        </clipPath>
      </defs>
      <g
        dangerouslySetInnerHTML={{ __html: ctx.getSerializedSvg() }}
        clipPath={`url(#${clipId})`}
      />
      {labelsEl}
      {legendEl}
      {treeEl}
    </>
  )
}
