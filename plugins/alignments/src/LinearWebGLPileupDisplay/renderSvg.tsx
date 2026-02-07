import type React from 'react'

import { getContainingView } from '@jbrowse/core/util'

import CoverageYScaleBar from './components/CoverageYScaleBar.tsx'
import { YSCALEBAR_LABEL_OFFSET } from './model.ts'

import type { LinearWebGLPileupDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

// Base colors for SNPs (matching theme defaults)
const BASE_COLORS: Record<string, string> = {
  A: '#00bf00',
  C: '#4747ff',
  G: '#ffa500',
  T: '#f00',
}

export async function renderSvg(
  model: LinearWebGLPileupDisplayModel,
  _opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  const { offsetPx } = view
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const {
    rpcData,
    showCoverage,
    coverageHeight,
    coverageTicks,
    visibleRegion,
  } = model

  if (!rpcData || !visibleRegion || !showCoverage) {
    return null
  }

  const {
    coverageDepths,
    coverageMaxDepth,
    coverageBinSize,
    numCoverageBins,
    regionStart,
    snpPositions,
    snpYOffsets,
    snpHeights,
    snpColorTypes,
    numSnpSegments,
  } = rpcData

  if (coverageMaxDepth === 0) {
    return null
  }

  const { start: viewStart, end: viewEnd } = visibleRegion
  const bpPerPx = (viewEnd - viewStart) / width
  const offset = YSCALEBAR_LABEL_OFFSET
  const effectiveHeight = coverageHeight - offset * 2

  let content = ''

  // Draw grey coverage bars
  for (let i = 0; i < numCoverageBins; i++) {
    const depth = coverageDepths[i]
    if (depth === undefined || depth === 0) {
      continue
    }

    const binStart = regionStart + i * coverageBinSize
    const binEnd = binStart + coverageBinSize

    if (binEnd < viewStart || binStart > viewEnd) {
      continue
    }

    const x = (binStart - viewStart) / bpPerPx
    const w = Math.max(coverageBinSize / bpPerPx, 1)
    const normalizedDepth = depth / coverageMaxDepth
    const barHeight = normalizedDepth * effectiveHeight
    const y = coverageHeight - offset - barHeight

    content += `<rect x="${x}" y="${y}" width="${w}" height="${barHeight}" fill="#ccc"/>`
  }

  // Draw SNP coverage bars on top
  const baseNames = ['A', 'C', 'G', 'T']
  for (let i = 0; i < numSnpSegments; i++) {
    const pos = snpPositions[i]
    const yOffset = snpYOffsets[i]
    const segHeight = snpHeights[i]
    const colorType = snpColorTypes[i]

    if (
      pos === undefined ||
      yOffset === undefined ||
      segHeight === undefined ||
      colorType === undefined
    ) {
      continue
    }

    const snpStart = regionStart + pos
    if (snpStart < viewStart || snpStart > viewEnd) {
      continue
    }

    const x = (snpStart - viewStart) / bpPerPx
    const w = Math.max(1 / bpPerPx, 1)
    const barY =
      coverageHeight - offset - (yOffset + segHeight) * effectiveHeight
    const barH = segHeight * effectiveHeight

    const baseName = baseNames[colorType - 1]
    const fillColor = baseName ? BASE_COLORS[baseName] : '#888'

    content += `<rect x="${x}" y="${barY}" width="${w}" height="${barH}" fill="${fillColor}"/>`
  }

  // Draw separator line at bottom of coverage area
  content += `<line x1="0" y1="${coverageHeight}" x2="${width}" y2="${coverageHeight}" stroke="#aaa" stroke-width="1"/>`

  return (
    <>
      <g dangerouslySetInnerHTML={{ __html: content }} />
      {coverageTicks ? (
        <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
          <CoverageYScaleBar model={model} orientation="left" />
        </g>
      ) : null}
    </>
  )
}
