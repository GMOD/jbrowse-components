import { getContainingView } from '@jbrowse/core/util'

import YScaleBar from '../shared/YScaleBar.tsx'
import { YSCALEBAR_LABEL_OFFSET, getScale } from '../util.ts'

import type { LinearWebGLMultiWiggleDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const ROW_PADDING = 2

export async function renderSvg(
  model: LinearWebGLMultiWiggleDisplayModel,
  _opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  const { offsetPx, bpPerPx } = view
  const height = model.height
  const { renderingType, ticks, rpcDataMap, domain, scaleType, numSources } =
    model

  if (rpcDataMap.size === 0 || !domain || numSources === 0) {
    return null
  }

  const [minScore, maxScore] = domain
  const blocks = view.dynamicBlocks.contentBlocks
  const rowHeight = (height - ROW_PADDING * (numSources - 1)) / numSources
  const offset = YSCALEBAR_LABEL_OFFSET
  const effectiveRowHeight = rowHeight - offset * 2

  const scale = getScale({
    scaleType,
    domain,
    range: [effectiveRowHeight, 0],
    inverted: false,
  })

  let content = ''

  for (const block of blocks) {
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
      const { featurePositions, featureScores, numFeatures, color } = source
      const rowY = sourceIdx * (rowHeight + ROW_PADDING)

      if (renderingType === 'multirowline') {
        let pathData = ''
        for (let i = 0; i < numFeatures; i++) {
          const posIdx = i * 2
          const featureStart = data.regionStart + featurePositions[posIdx]!
          const featureEnd = data.regionStart + featurePositions[posIdx + 1]!
          const score = featureScores[i]!

          if (featureEnd < block.start || featureStart > block.end) {
            continue
          }

          const x = (featureStart - block.start) / bpPerPx + blockScreenX
          const y = scale(score) + offset + rowY
          pathData += `${pathData === '' ? 'M' : 'L'}${x},${y}`
        }
        if (pathData) {
          content += `<path fill="none" stroke="${color}" stroke-width="1" d="${pathData}"/>`
        }
      } else {
        for (let i = 0; i < numFeatures; i++) {
          const posIdx = i * 2
          const featureStart = data.regionStart + featurePositions[posIdx]!
          const featureEnd = data.regionStart + featurePositions[posIdx + 1]!
          const score = featureScores[i]!

          if (featureEnd < block.start || featureStart > block.end) {
            continue
          }

          const x = (featureStart - block.start) / bpPerPx + blockScreenX
          const w = Math.max((featureEnd - featureStart) / bpPerPx, 1)

          if (renderingType === 'multirowxy') {
            const y = scale(score) + offset + rowY
            const originY = scale(0) + offset + rowY
            const rectY = Math.min(y, originY)
            const rectHeight = Math.abs(originY - y) || 1
            content += `<rect x="${x}" y="${rectY}" width="${w}" height="${rectHeight}" fill="${color}"/>`
          } else if (renderingType === 'multirowdensity') {
            let norm: number
            if (scaleType === 'log') {
              const logMin = Math.log2(Math.max(minScore, 1))
              const logMax = Math.log2(Math.max(maxScore, 1))
              const logScore = Math.log2(Math.max(score, 1))
              norm = (logScore - logMin) / (logMax - logMin)
            } else {
              norm = (score - minScore) / (maxScore - minScore)
            }
            norm = Math.max(0, Math.min(1, norm))
            content += `<rect x="${x}" y="${rowY}" width="${w}" height="${rowHeight}" fill="${color}" fill-opacity="${norm}"/>`
          }
        }
      }
    }
  }

  return (
    <>
      <g dangerouslySetInnerHTML={{ __html: content }} />
      {ticks ? (
        <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
          <YScaleBar model={model as unknown as { ticks: typeof ticks }} />
        </g>
      ) : null}
    </>
  )
}
