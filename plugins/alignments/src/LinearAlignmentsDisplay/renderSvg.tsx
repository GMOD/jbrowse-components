import type React from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'

import CoverageYScaleBar from './components/CoverageYScaleBar.tsx'
import { YSCALEBAR_LABEL_OFFSET } from './model.ts'

import type { LinearAlignmentsDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function renderSvg(
  model: LinearAlignmentsDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const theme = createJBrowseTheme(opts?.theme)
  const view = getContainingView(model) as LGV
  const { offsetPx, bpPerPx } = view
  const {
    rpcDataMap,
    showCoverage,
    coverageHeight,
    coverageTicks,
  } = model

  if (rpcDataMap.size === 0 || !showCoverage) {
    return null
  }

  const blocks = view.dynamicBlocks.contentBlocks
  const offset = YSCALEBAR_LABEL_OFFSET
  const effectiveHeight = coverageHeight - offset * 2

  let content = ''

  for (const block of blocks) {
    if (block.regionNumber === undefined) {
      continue
    }
    const data = rpcDataMap.get(block.regionNumber)
    if (!data) {
      continue
    }
    const {
      coverageDepths,
      coverageMaxDepth,
      coverageBinSize,
      coverageStartOffset,
      numCoverageBins,
      regionStart,
      snpPositions,
      snpYOffsets,
      snpHeights,
      snpColorTypes,
      numSnpSegments,
    } = data

    if (coverageMaxDepth === 0) {
      continue
    }

    const blockScreenX = block.offsetPx - offsetPx
    const nicedMax = coverageTicks?.nicedMax ?? coverageMaxDepth

    const coverageColor =
      theme.palette.mode === 'dark'
        ? theme.palette.grey[700]
        : theme.palette.grey[400]

    for (let i = 0; i < numCoverageBins; i++) {
      const depth = coverageDepths[i]
      if (depth === undefined || depth === 0) {
        continue
      }

      const binStart = regionStart + coverageStartOffset + i * coverageBinSize
      const binEnd = binStart + coverageBinSize

      if (binEnd < block.start || binStart > block.end) {
        continue
      }

      const x = (binStart - block.start) / bpPerPx + blockScreenX
      const w = Math.max(coverageBinSize / bpPerPx, 1)
      const normalizedDepth = depth / nicedMax
      const barHeight = normalizedDepth * effectiveHeight
      const y = coverageHeight - offset - barHeight

      content += `<rect x="${x}" y="${y}" width="${w}" height="${barHeight}" fill="${coverageColor}"/>`
    }

    const baseNames = ['A', 'C', 'G', 'T']
    const depthScale = coverageMaxDepth / nicedMax

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
      if (snpStart < block.start || snpStart > block.end) {
        continue
      }

      const x = (snpStart - block.start) / bpPerPx + blockScreenX
      const w = Math.max(1 / bpPerPx, 1)
      const barY =
        coverageHeight -
        offset -
        (yOffset + segHeight) * depthScale * effectiveHeight
      const barH = segHeight * depthScale * effectiveHeight

      const baseName = baseNames[colorType - 1]
      const fillColor = baseName
        ? theme.palette.bases[baseName as 'A' | 'C' | 'G' | 'T'].main
        : theme.palette.grey[600]

      content += `<rect x="${x}" y="${barY}" width="${w}" height="${barH}" fill="${fillColor}"/>`
    }
  }

  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const separatorColor = theme.palette.grey[500]
  content += `<line x1="0" y1="${coverageHeight}" x2="${width}" y2="${coverageHeight}" stroke="${separatorColor}" stroke-width="1"/>`

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
