import React from 'react'
import { getSession } from '@jbrowse/core/util'
import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import { useTheme } from '@mui/material'

// locals
import { LinearGenomeViewModel, HEADER_OVERVIEW_HEIGHT } from '..'
import Cytobands from '../components/Cytobands'
import { Polygon } from '../components/OverviewScalebar'
import SVGRuler from './SVGRuler'
import SVGScalebar from './SVGScalebar'

type LGV = LinearGenomeViewModel

export default function SVGHeader({
  model,
  fontSize,
  cytobandHeight,
  rulerHeight,
}: {
  model: LGV
  rulerHeight: number
  fontSize: number
  cytobandHeight: number
}) {
  const { width, assemblyNames, showCytobands, displayedRegions } = model
  const { assemblyManager } = getSession(model)
  const assemblyName = assemblyNames.length > 1 ? '' : assemblyNames[0]
  const assembly = assemblyManager.get(assemblyName)
  const theme = useTheme()

  const overview = Base1DView.create({
    displayedRegions: JSON.parse(JSON.stringify(displayedRegions)),
    interRegionPaddingWidth: 0,
    minimumBlockWidth: model.minimumBlockWidth,
  })
  const visibleRegions = model.dynamicBlocks.contentBlocks

  overview.setVolatileWidth(width)
  overview.showAllRegions()
  const block = overview.dynamicBlocks.contentBlocks[0]

  const first = visibleRegions[0]
  const firstOverviewPx =
    overview.bpToPx({
      ...first,
      coord: first.reversed ? first.end : first.start,
    }) || 0

  const last = visibleRegions[visibleRegions.length - 1]
  const lastOverviewPx =
    overview.bpToPx({
      ...last,
      coord: last.reversed ? last.start : last.end,
    }) || 0
  const c = +showCytobands * cytobandHeight
  return (
    <g id="header">
      <text
        x={0}
        y={fontSize}
        fontSize={fontSize}
        fill={theme.palette.text.primary}
      >
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

      <g transform={`translate(0 ${fontSize + c})`}>
        <SVGScalebar model={model} fontSize={fontSize} />
      </g>
      <g transform={`translate(0 ${rulerHeight + c})`}>
        <SVGRuler model={model} fontSize={fontSize} />
      </g>
    </g>
  )
}
