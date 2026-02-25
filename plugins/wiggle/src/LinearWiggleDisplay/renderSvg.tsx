import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'

import DensityLegend from '../shared/DensityLegend.tsx'
import YScaleBar from '../shared/YScaleBar.tsx'
import { getDensityColor } from '../shared/getDensityColor.ts'
import { YSCALEBAR_LABEL_OFFSET, getScale } from '../util.ts'

import type { LinearWiggleDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

function renderToCtx(
  ctx: CanvasRenderingContext2D | SvgCanvas,
  model: LinearWiggleDisplayModel,
  view: LGV,
) {
  const { offsetPx, bpPerPx } = view
  const height = model.height
  const {
    renderingType,
    rpcDataMap,
    domain,
    scaleType,
    color,
    posColor,
    negColor,
    bicolorPivot,
  } = model

  if (!domain) {
    return
  }

  const [minScore, maxScore] = domain
  const offset = YSCALEBAR_LABEL_OFFSET
  const effectiveHeight = height - offset * 2
  const useBicolor = color === '#f0f' || color === '#ff00ff'

  const scale = getScale({
    scaleType,
    domain,
    range: [effectiveHeight, 0],
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
    const { featurePositions, featureScores, regionStart, numFeatures } = data
    const blockScreenX = block.offsetPx - offsetPx

    if (renderingType === 'line') {
      const strokeColor = useBicolor ? posColor : color
      ctx.beginPath()
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = 1
      let started = false
      for (let i = 0; i < numFeatures; i++) {
        const posIdx = i * 2
        const featureStart = regionStart + featurePositions[posIdx]!
        const featureEnd = regionStart + featurePositions[posIdx + 1]!
        const score = featureScores[i]!
        if (featureEnd < block.start || featureStart > block.end) {
          continue
        }
        const x = (featureStart - block.start) / bpPerPx + blockScreenX
        const xEnd = (featureEnd - block.start) / bpPerPx + blockScreenX
        const y = scale(score) + offset
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
        const featureStart = regionStart + featurePositions[posIdx]!
        const featureEnd = regionStart + featurePositions[posIdx + 1]!
        const score = featureScores[i]!
        if (featureEnd < block.start || featureStart > block.end) {
          continue
        }
        const x = (featureStart - block.start) / bpPerPx + blockScreenX
        const w = Math.max((featureEnd - featureStart) / bpPerPx, 1)

        if (renderingType === 'xyplot') {
          const y = scale(score) + offset
          const originY = scale(bicolorPivot) + offset
          const rectY = Math.min(y, originY)
          const rectHeight = Math.abs(originY - y) || 1
          ctx.fillStyle = useBicolor
            ? score >= bicolorPivot
              ? posColor
              : negColor
            : color
          ctx.fillRect(x, rectY, w + 0.5, rectHeight)
        } else if (renderingType === 'scatter') {
          const y = scale(score) + offset
          ctx.fillStyle = useBicolor
            ? score >= bicolorPivot
              ? posColor
              : negColor
            : color
          ctx.fillRect(x, y - 1, w, 2)
        } else if (renderingType === 'density') {
          ctx.fillStyle = getDensityColor(
            score,
            minScore,
            maxScore,
            scaleType,
            posColor,
          )
          ctx.fillRect(x, 0, w, height)
        }
      }
    }
  }
}

export async function renderSvg(
  model: LinearWiggleDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  const { offsetPx } = view
  const height = model.height
  const { ticks, rpcDataMap, domain, scaleType } = model

  if (rpcDataMap.size === 0 || !domain) {
    return null
  }

  let legendEl: React.ReactNode = null
  if (model.isDensityMode) {
    legendEl = (
      <DensityLegend
        domain={domain}
        scaleType={scaleType}
        canvasWidth={Math.round(view.width)}
      />
    )
  } else if (ticks) {
    legendEl = (
      <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
        <YScaleBar
          model={model as unknown as { ticks: typeof ticks }}
          orientation="left"
        />
      </g>
    )
  }

  if (opts?.rasterizeLayers) {
    const totalWidth = view.dynamicBlocks.totalWidthPx
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
        {legendEl}
      </>
    )
  }

  const ctx = new SvgCanvas()
  renderToCtx(ctx, model, view)

  const clipId = `wiggle-clip-${model.id}`
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
      {legendEl}
    </>
  )
}
