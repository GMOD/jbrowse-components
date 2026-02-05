import { getContainingView } from '@jbrowse/core/util'

import YScaleBar from '../shared/YScaleBar.tsx'
import { getScale, YSCALEBAR_LABEL_OFFSET } from '../util.ts'

import type { LinearWebGLMultiWiggleDisplayModel } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const ROW_PADDING = 2

export async function renderSvg(
  model: LinearWebGLMultiWiggleDisplayModel,
): Promise<React.ReactNode> {
  console.log('renderSvg multi: start')
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
    numSources,
    visibleRegion,
  } = model

  console.log('renderSvg multi: got model properties', {
    renderingType,
    numSources,
  })

  if (!rpcData || !domain || !visibleRegion || numSources === 0) {
    console.log('renderSvg multi: early return - missing data')
    return null
  }

  const [minScore, maxScore] = domain
  const { start: viewStart, end: viewEnd } = visibleRegion
  const bpPerPx = (viewEnd - viewStart) / width
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

  console.log(
    'renderSvg multi: starting loop, numSources:',
    rpcData.sources.length,
  )

  for (let sourceIdx = 0; sourceIdx < rpcData.sources.length; sourceIdx++) {
    const source = rpcData.sources[sourceIdx]!
    const { featurePositions, featureScores, numFeatures, color } = source
    const rowY = sourceIdx * (rowHeight + ROW_PADDING)
    console.log(
      'renderSvg multi: processing source',
      sourceIdx,
      'numFeatures:',
      numFeatures,
    )

    if (renderingType === 'multirowline') {
      let pathData = ''
      for (let i = 0; i < numFeatures; i++) {
        const posIdx = i * 2
        const featureStart = rpcData.regionStart + featurePositions[posIdx]!
        const featureEnd = rpcData.regionStart + featurePositions[posIdx + 1]!
        const score = featureScores[i]!

        if (featureEnd < viewStart || featureStart > viewEnd) {
          continue
        }

        const x = (featureStart - viewStart) / bpPerPx
        const y = scale(score) + offset + rowY
        pathData += `${pathData === '' ? 'M' : 'L'}${x},${y}`
      }
      if (pathData) {
        content += `<path fill="none" stroke="${color}" stroke-width="1" d="${pathData}"/>`
      }
    } else {
      for (let i = 0; i < numFeatures; i++) {
        const posIdx = i * 2
        const featureStart = rpcData.regionStart + featurePositions[posIdx]!
        const featureEnd = rpcData.regionStart + featurePositions[posIdx + 1]!
        const score = featureScores[i]!

        if (featureEnd < viewStart || featureStart > viewEnd) {
          continue
        }

        const x = (featureStart - viewStart) / bpPerPx
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

  console.log('renderSvg multi: loop complete, content length:', content.length)

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

  console.log('renderSvg multi: done')
  return result
}
