import { getSession, stripAlpha } from '@jbrowse/core/util'
import {
  createOverviewLayout,
  getContentBlocksPxSpan,
} from '@jbrowse/core/util/Base1DUtils'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import { useTheme } from '@mui/material'

import SVGRuler from './SVGRuler.tsx'
import SVGScalebar from './SVGScalebar.tsx'
import Cytobands from '../components/Cytobands.tsx'
import OverviewScalebarPolygon from '../components/OverviewScalebarPolygon.tsx'
import { getCytobands } from '../components/util.ts'
import { HEADER_OVERVIEW_HEIGHT } from '../consts.ts'

import type { LinearGenomeViewModel } from '../index.ts'

export default function SVGHeader({
  model,
  fontSize,
  cytobandHeight,
  rulerHeight,
}: {
  model: LinearGenomeViewModel
  rulerHeight: number
  fontSize: number
  cytobandHeight: number
}) {
  const {
    width,
    assemblyNames,
    showCytobands,
    displayedRegions,
    minimumBlockWidth,
  } = model
  const { assemblyManager } = getSession(model)
  const assemblyName =
    assemblyNames.length === 1 ? assemblyNames[0] : undefined
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined
  const theme = useTheme()
  const c = stripAlpha(theme.palette.text.primary)
  const visibleRegions = model.dynamicBlocks.contentBlocks
  if (!visibleRegions.length) {
    return null
  }

  const overview = createOverviewLayout({
    displayedRegions,
    width,
    minimumBlockWidth,
  })
  const block = calculateDynamicBlocks(overview).contentBlocks[0]!
  const span = getContentBlocksPxSpan(overview, visibleRegions)
  const y = +showCytobands * cytobandHeight
  return (
    <g id="header">
      {assemblyName ? (
        <text
          x={0}
          y={0}
          dominantBaseline="hanging"
          fontSize={fontSize}
          fill={c}
        >
          {assemblyName}
        </text>
      ) : null}

      {showCytobands && span ? (
        <g transform={`translate(0 ${rulerHeight})`}>
          <Cytobands
            overview={overview}
            cytobands={getCytobands(assembly, block.refName)}
            block={block}
          />
          <rect
            stroke="red"
            fill="rgb(255,0,0)"
            fillOpacity={0.1}
            width={Math.max(span.rightPx - span.leftPx, 0.5)}
            height={HEADER_OVERVIEW_HEIGHT - 1}
            x={span.leftPx}
            y={0.5}
          />
          <g transform={`translate(0,${HEADER_OVERVIEW_HEIGHT})`}>
            <OverviewScalebarPolygon
              overview={overview}
              model={model}
              useOffset={false}
            />
          </g>
        </g>
      ) : null}

      <g transform={`translate(0 ${fontSize + y})`}>
        <SVGScalebar model={model} fontSize={fontSize} />
      </g>
      <g transform={`translate(0 ${rulerHeight + y})`}>
        <SVGRuler model={model} fontSize={fontSize} />
      </g>
    </g>
  )
}
