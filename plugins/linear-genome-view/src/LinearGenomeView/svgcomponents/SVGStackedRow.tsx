import SVGRowHeader from './SVGRowHeader.tsx'
import SVGView from './SVGView.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type { SvgDisplayResult } from './util.ts'
import type { TrackLabelMode } from '@jbrowse/display-kit/types'

/**
 * One view of a stacked export: its ruler, with the assembly name and scalebar
 * above it, over its track bodies. `top` is where the ruler starts; the caller
 * reserves `getRowHeaderLayout().bandHeight` above it for the header to draw
 * into, and the row is `rulerHeight + rendered.tracksHeight` tall below it.
 */
export default function SVGStackedRow({
  view,
  rendered,
  top,
  margin,
  fontSize,
  textHeight,
  rulerHeight,
  trackLabels,
  trackLabelOffset,
  showGridlines,
  legendWidth,
  showAssemblyName,
  showScalebar,
}: {
  view: LinearGenomeViewModel
  rendered: { displayResults: SvgDisplayResult[]; tracksHeight: number }
  top: number
  margin: number
  fontSize: number
  textHeight: number
  rulerHeight: number
  trackLabels: TrackLabelMode
  trackLabelOffset: number
  showGridlines: boolean
  legendWidth?: number
  showAssemblyName?: boolean
  showScalebar?: boolean
}) {
  return (
    <g transform={`translate(${margin} ${top})`}>
      <SVGView
        view={view}
        displayResults={rendered.displayResults}
        header={
          <SVGRowHeader
            view={view}
            fontSize={fontSize}
            rulerHeight={rulerHeight}
            showAssemblyName={showAssemblyName}
            showScalebar={showScalebar}
          />
        }
        fontSize={fontSize}
        textHeight={textHeight}
        trackLabels={trackLabels}
        trackLabelOffset={trackLabelOffset}
        contentTop={rulerHeight}
        tracksHeight={rendered.tracksHeight}
        showGridlines={showGridlines}
        leftBuffer={margin}
        legendWidth={legendWidth}
      />
    </g>
  )
}
