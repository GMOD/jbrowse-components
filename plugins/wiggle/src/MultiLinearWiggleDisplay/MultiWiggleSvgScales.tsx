import { SvgRowLabels } from '@jbrowse/tree-sidebar'
import { YScaleBar } from '@jbrowse/wiggle-core'

import OverlayColorLegend from '../shared/OverlayColorLegend.tsx'
import ScoreLegend from '../shared/ScoreLegend.tsx'
import { getRowTop } from '../shared/wiggleComponentUtils.ts'

import type { YScaleTicks } from '@jbrowse/wiggle-core'

// Source-row labels (or overlay color legend) plus the Y-scale legend, shared
// by the live MultiWiggleComponent and the SVG export path so the two can't
// drift. Callers pass their own `canvasWidth`/`scalebarLeft`/`labelOffset`
// (CSS-pixel track width on screen vs view width on export, etc.).
interface ScaleModel {
  sources: {
    name: string
    label?: string
    color?: string
    labelColor?: string
    group?: string
  }[]
  isOverlay: boolean
  posColor: string
  rowHeight: number
  isDensityMode: boolean
  domain: [number, number] | undefined
  scaleType: string
  ticks?: YScaleTicks
  rowHeightTooSmallForScalebar: boolean
  numSources: number
}

export default function MultiWiggleSvgScales({
  model,
  canvasWidth,
  scalebarLeft,
  labelOffset,
}: {
  model: ScaleModel
  canvasWidth: number
  scalebarLeft: number
  labelOffset: number
}) {
  const {
    sources,
    isOverlay,
    posColor,
    rowHeight,
    isDensityMode,
    domain,
    scaleType,
    ticks,
    rowHeightTooSmallForScalebar,
    numSources,
  } = model

  const labels =
    sources.length > 1 ? (
      isOverlay ? (
        <OverlayColorLegend
          sources={sources}
          fallbackColor={posColor}
          canvasWidth={canvasWidth}
        />
      ) : (
        <SvgRowLabels
          sources={sources}
          rowHeight={rowHeight}
          labelOffset={labelOffset}
        />
      )
    ) : null

  const scoreLegend = domain ? (
    <ScoreLegend
      domain={domain}
      scaleType={scaleType}
      canvasWidth={canvasWidth}
    />
  ) : null

  // overlay draws one scalebar over the full height (rowHeight === height, so
  // getRowTop(0) === 0); rows draw one per source down the track.
  const scalebars = !domain ? null : isDensityMode ? (
    scoreLegend
  ) : !ticks ? null : rowHeightTooSmallForScalebar ? (
    scoreLegend
  ) : (
    <g transform={`translate(${scalebarLeft})`}>
      {Array.from({ length: isOverlay ? 1 : numSources }).map((_, idx) => (
        <g
          // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, one scalebar per source row
          key={`scalebar-${idx}`}
          transform={`translate(0 ${getRowTop(idx, rowHeight)})`}
        >
          <YScaleBar ticks={ticks} orientation="left" />
        </g>
      ))}
    </g>
  )

  return (
    <>
      {labels}
      {scalebars}
    </>
  )
}
