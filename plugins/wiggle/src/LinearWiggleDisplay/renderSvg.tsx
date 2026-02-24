import { getContainingView } from '@jbrowse/core/util'

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

export async function renderSvg(
  model: LinearWiggleDisplayModel,
  _opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  const { offsetPx, bpPerPx } = view
  const height = model.height
  const {
    renderingType,
    ticks,
    rpcDataMap,
    domain,
    scaleType,
    color,
    posColor,
    negColor,
    bicolorPivot,
  } = model

  if (rpcDataMap.size === 0 || !domain) {
    return null
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

  let content = ''
  const blocks = view.dynamicBlocks.contentBlocks

  for (const block of blocks) {
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
      let pathData = ''
      for (let i = 0; i < numFeatures; i++) {
        const posIdx = i * 2
        const featureStart = regionStart + featurePositions[posIdx]!
        const featureEnd = regionStart + featurePositions[posIdx + 1]!
        const score = featureScores[i]!

        if (featureEnd < block.start || featureStart > block.end) {
          continue
        }

        const x = (featureStart - block.start) / bpPerPx + blockScreenX
        const y = scale(score) + offset
        pathData += `${pathData === '' ? 'M' : 'L'}${x},${y}`
      }
      if (pathData) {
        const strokeColor = useBicolor ? '#555' : color
        content += `<path fill="none" stroke="${strokeColor}" stroke-width="1" d="${pathData}"/>`
      }
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
          const fillColor = useBicolor
            ? score >= bicolorPivot
              ? posColor
              : negColor
            : color
          content += `<rect x="${x}" y="${rectY}" width="${w}" height="${rectHeight}" fill="${fillColor}"/>`
        } else if (renderingType === 'scatter') {
          const y = scale(score) + offset
          const fillColor = useBicolor
            ? score >= bicolorPivot
              ? posColor
              : negColor
            : color
          content += `<rect x="${x}" y="${y - 1}" width="${w}" height="2" fill="${fillColor}"/>`
        } else if (renderingType === 'density') {
          const densityColor = getDensityColor(
            score,
            minScore,
            maxScore,
            scaleType,
            posColor,
          )
          content += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="${densityColor}"/>`
        }
      }
    }
  }

  let legendEl: React.ReactNode = null
  if (model.isDensityMode) {
    const canvasWidth = Math.round(view.width)
    legendEl = (
      <DensityLegend
        domain={domain}
        scaleType={scaleType}
        canvasWidth={canvasWidth}
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

  return (
    <>
      <g dangerouslySetInnerHTML={{ __html: content }} />
      {legendEl}
    </>
  )
}
