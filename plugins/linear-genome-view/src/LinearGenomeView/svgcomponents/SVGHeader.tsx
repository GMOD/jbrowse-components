import { getFillProps, getSession } from '@jbrowse/core/util'
import {
  createOverviewLayout,
  getContentBlocksPxSpan,
} from '@jbrowse/core/util/Base1DUtils'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import { useTheme } from '@mui/material'

import SVGRuler from './SVGRuler.tsx'
import SVGScalebar from './SVGScalebar.tsx'
import { getHeaderLayout } from './util.ts'
import Cytobands from '../components/Cytobands.tsx'
import OverviewScalebarPolygon from '../components/OverviewScalebarPolygon.tsx'
import { getCytobands } from '../components/util.ts'
import { HEADER_OVERVIEW_HEIGHT } from '../consts.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

// "you are here" cytoband overview rendered above the ruler. Self-contained so
// the overview-layout work only runs when cytobands are actually shown.
function CytobandOverview({
  model,
  assembly,
  y,
}: {
  model: LinearGenomeViewModel
  assembly: Assembly | undefined
  y: number
}) {
  const { width, displayedRegions, minimumBlockWidth } = model
  const overview = createOverviewLayout({
    displayedRegions,
    width,
    minimumBlockWidth,
  })
  const block = calculateDynamicBlocks(overview).contentBlocks[0]
  const span = getContentBlocksPxSpan(
    overview,
    model.dynamicBlocks.contentBlocks,
  )
  return block && span ? (
    <g transform={`translate(0 ${y})`}>
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
        <OverviewScalebarPolygon overview={overview} model={model} />
      </g>
    </g>
  ) : null
}

export default function SVGHeader({
  model,
  fontSize,
  rulerHeight,
}: {
  model: LinearGenomeViewModel
  rulerHeight: number
  fontSize: number
}) {
  const { assemblyNames, showCytobands } = model
  const { assemblyManager } = getSession(model)
  // cytobands need a single unambiguous assembly, but the header label names
  // every assembly in the view
  const cytobandAssemblyName =
    assemblyNames.length === 1 ? assemblyNames[0] : undefined
  const assembly = cytobandAssemblyName
    ? assemblyManager.get(cytobandAssemblyName)
    : undefined
  const theme = useTheme()
  const fillProps = getFillProps(theme.palette.text.primary)
  const visibleRegions = model.dynamicBlocks.contentBlocks
  if (!visibleRegions.length) {
    return null
  }

  const { cytobandTop, scalebarLineY, rulerTop } = getHeaderLayout({
    fontSize,
    showCytobands,
    rulerHeight,
  })
  return (
    <g id="header">
      {assemblyNames.length ? (
        <text
          x={0}
          y={0}
          dominantBaseline="hanging"
          fontSize={fontSize}
          {...fillProps}
        >
          {assemblyNames.join(', ')}
        </text>
      ) : null}

      {showCytobands ? (
        <CytobandOverview model={model} assembly={assembly} y={cytobandTop} />
      ) : null}

      <g transform={`translate(0 ${scalebarLineY})`}>
        <SVGScalebar model={model} fontSize={fontSize} />
      </g>
      <g transform={`translate(0 ${rulerTop})`}>
        <SVGRuler model={model} fontSize={fontSize} rulerHeight={rulerHeight} />
      </g>
    </g>
  )
}
