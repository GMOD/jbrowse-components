import React from 'react'
import { getSession } from '@jbrowse/core/util'
import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import { useTheme } from '@mui/material'
import Color from 'color'

// locals
import { LinearGenomeViewModel, HEADER_OVERVIEW_HEIGHT } from '..'
import Cytobands from '../components/Cytobands'
import { Polygon } from '../components/OverviewScalebar'
import SVGRuler from './SVGRuler'
import SVGScalebar from './SVGScalebar'

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
  const { width, assemblyNames, showCytobands, displayedRegions } = model
  const { assemblyManager } = getSession(model)
  const assemblyName = assemblyNames.length > 1 ? '' : assemblyNames[0]
  const assembly = assemblyManager.get(assemblyName)
  const theme = useTheme()
  const c = Color(theme.palette.text.primary).hex()
  const overview = Base1DView.create({
    displayedRegions: JSON.parse(JSON.stringify(displayedRegions)),
    interRegionPaddingWidth: 0,
    minimumBlockWidth: model.minimumBlockWidth,
  })
  const visibleRegions = model.dynamicBlocks.contentBlocks
  if (!visibleRegions.length) {
    return null
  }

  overview.setVolatileWidth(width)
  overview.showAllRegions()
  const block = overview.dynamicBlocks.contentBlocks[0]
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const first = visibleRegions.at(0)!
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const last = visibleRegions.at(-1)!
  const firstOverviewPx =
    overview.bpToPx({
      ...first,
      coord: first.reversed ? first.end : first.start,
    }) || 0

  const lastOverviewPx =
    overview.bpToPx({
      ...last,
      coord: last.reversed ? last.start : last.end,
    }) || 0
  const y = +showCytobands * cytobandHeight
  return (
    <g id="header">
      <text x={0} y={0} dominantBaseline="hanging" fontSize={fontSize} fill={c}>
        {assemblyName}
      </text>

      {showCytobands ? (
        <g transform={`translate(0 ${rulerHeight})`}>
          <Cytobands overview={overview} assembly={assembly} block={block} />
          <rect
            stroke="red"
            fill="rgb(255,0,0,0.1)"
            width={Math.max(lastOverviewPx - firstOverviewPx, 0.5)}
            height={HEADER_OVERVIEW_HEIGHT - 1}
            x={firstOverviewPx}
            y={0.5}
          />
          <g transform={`translate(0,${HEADER_OVERVIEW_HEIGHT})`}>
            <Polygon overview={overview} model={model} useOffset={false} />
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
