import { getContainingView, measureText } from '@jbrowse/core/util'

import DensityLegend from '../shared/DensityLegend.tsx'
import YScaleBar from '../shared/YScaleBar.tsx'
import { getRowHeight, getRowTop } from '../shared/wiggleComponentUtils.ts'
import { YSCALEBAR_LABEL_OFFSET, getScale } from '../util.ts'

import type { LinearWebGLMultiWiggleDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

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
  const rowHeight = getRowHeight(height, numSources)
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
      const rowY = getRowTop(sourceIdx, rowHeight)

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

  const canvasWidth = Math.round(view.width)
  const tooSmallForScalebar = rowHeight < 70
  const isDensity = model.isDensityMode

  let legendEl: React.ReactNode = null
  if (isDensity && domain) {
    legendEl = (
      <DensityLegend domain={domain} scaleType={scaleType} canvasWidth={canvasWidth} />
    )
  } else if (ticks) {
    if (tooSmallForScalebar) {
      const legend = `[${ticks.values[0]?.toFixed(0)}-${ticks.values[1]?.toFixed(0)}]${scaleType === 'log' ? ' (log)' : ''}`
      const len = measureText(legend, 12)
      const xpos = canvasWidth - len - 60
      legendEl = (
        <g>
          <rect
            x={xpos - 3}
            y={0}
            width={len + 6}
            height={16}
            fill="rgba(255,255,255,0.8)"
          />
          <text y={12} x={xpos} fontSize={12}>
            {legend}
          </text>
        </g>
      )
    } else {
      legendEl = (
        <g transform={`translate(${Math.max(-offsetPx, 0) + 50} 0)`}>
          {Array.from({ length: numSources }).map((_, idx) => (
            <g
              transform={`translate(0 ${getRowTop(idx, rowHeight)})`}
              key={`scalebar-${idx}`}
            >
              <YScaleBar model={model as unknown as { ticks: typeof ticks }} />
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
    const labelWidth =
      Math.max(...sources.map(s => measureText(s.name, 10))) + 10
    labelsEl = (
      <g transform={`translate(${labelOffset} 0)`}>
        {sources.map((source, idx) => {
          const y = getRowTop(idx, rowHeight)
          const boxHeight = Math.min(20, rowHeight)
          const lc = source.labelColor
          return (
            <g key={source.name}>
              <rect
                x={0}
                y={y}
                width={labelWidth}
                height={boxHeight}
                fill={lc ?? 'rgba(255,255,255,0.8)'}
              />
              <text
                x={4}
                y={y + boxHeight / 2 + 3}
                fontSize={10}
                fill={lc ? 'white' : 'black'}
              >
                {source.name}
              </text>
            </g>
          )
        })}
      </g>
    )
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
    treeEl = (
      <path
        d={treePaths}
        fill="none"
        stroke="#0008"
        strokeWidth={1}
      />
    )
  }

  return (
    <>
      <g dangerouslySetInnerHTML={{ __html: content }} />
      {labelsEl}
      {legendEl}
      {treeEl}
    </>
  )
}
