import { getContainingView } from '@jbrowse/core/util'

import YScaleBar from '../shared/YScaleBar.tsx'
import { getScale, YSCALEBAR_LABEL_OFFSET } from '../util.ts'

import type { LinearWebGLWiggleDisplayModel } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function renderSvg(
  model: LinearWebGLWiggleDisplayModel,
): Promise<React.ReactNode> {
  console.log('renderSvg: start')
  const view = getContainingView(model) as LGV
  const { offsetPx } = view
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const height = model.height
  const {
    renderingType,
    ticks,
    rpcData,
    domain,
    scaleType,
    color,
    posColor,
    negColor,
    bicolorPivot,
    visibleRegion,
  } = model

  console.log('renderSvg: got model properties', {
    renderingType,
    numFeatures: rpcData?.numFeatures,
  })

  if (!rpcData || !domain || !visibleRegion) {
    console.log('renderSvg: early return - missing data')
    return null
  }

  const { featurePositions, featureScores, regionStart, numFeatures } = rpcData
  const [minScore, maxScore] = domain
  const { start: viewStart, end: viewEnd } = visibleRegion
  const bpPerPx = (viewEnd - viewStart) / width
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

  console.log('renderSvg: starting loop, numFeatures:', numFeatures)

  if (renderingType === 'line') {
    let pathData = ''
    for (let i = 0; i < numFeatures; i++) {
      const posIdx = i * 2
      const featureStart = regionStart + featurePositions[posIdx]!
      const featureEnd = regionStart + featurePositions[posIdx + 1]!
      const score = featureScores[i]!

      if (featureEnd < viewStart || featureStart > viewEnd) {
        continue
      }

      const x = (featureStart - viewStart) / bpPerPx
      const y = scale(score) + offset
      pathData += `${pathData === '' ? 'M' : 'L'}${x},${y}`
    }
    const strokeColor = useBicolor ? '#555' : color
    content = `<path fill="none" stroke="${strokeColor}" stroke-width="1" d="${pathData}"/>`
  } else {
    for (let i = 0; i < numFeatures; i++) {
      const posIdx = i * 2
      const featureStart = regionStart + featurePositions[posIdx]!
      const featureEnd = regionStart + featurePositions[posIdx + 1]!
      const score = featureScores[i]!

      if (featureEnd < viewStart || featureStart > viewEnd) {
        continue
      }

      const x = (featureStart - viewStart) / bpPerPx
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
      } else if (renderingType === 'density') {
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
        content += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="${posColor}" fill-opacity="${norm}"/>`
      }
    }
  }

  console.log('renderSvg: loop complete, content length:', content.length)

  const result = (
    <>
      <g dangerouslySetInnerHTML={{ __html: content }} />
      {ticks ? (
        <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
          <YScaleBar model={model as unknown as { ticks: typeof ticks }} />
        </g>
      ) : null}
    </>
  )

  console.log('renderSvg: done')
  return result
}
