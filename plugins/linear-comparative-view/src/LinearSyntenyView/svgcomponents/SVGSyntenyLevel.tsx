import { Fragment } from 'react'
import type { ReactNode } from 'react'

import SVGLinearGenomeView from './SVGLinearGenomeView.tsx'

import type { ViewDisplayResults } from './SVGLinearGenomeView.tsx'
import type {
  LinearGenomeViewModel,
  TrackLabelMode,
} from '@jbrowse/plugin-linear-genome-view'

export default function SVGSyntenyLevel({
  clipId,
  yOffset,
  width,
  levelHeight,
  shift,
  trackLabelOffset,
  fontSize,
  rendering,
  rulerHeight,
  textHeight,
  trackLabels,
  displayResults,
  view,
  showGridlines,
  tracksHeight,
}: {
  clipId: string
  yOffset: number
  width: number
  levelHeight: number
  shift: number
  trackLabelOffset: number
  fontSize: number
  rendering: ReactNode[]
  rulerHeight: number
  textHeight: number
  trackLabels: TrackLabelMode
  displayResults: ViewDisplayResults
  view: LinearGenomeViewModel
  showGridlines: boolean
  tracksHeight: number
}) {
  return (
    <g transform={`translate(0 ${yOffset})`}>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={width} height={levelHeight} />
        </clipPath>
      </defs>
      <g
        transform={`translate(${shift + trackLabelOffset} ${fontSize})`}
        clipPath={`url(#${clipId})`}
      >
        {rendering.map((r, j) => (
          <Fragment key={j}>{r}</Fragment>
        ))}
      </g>
      <g transform={`translate(0 ${levelHeight})`}>
        <SVGLinearGenomeView
          rulerHeight={rulerHeight}
          shift={shift}
          trackLabelOffset={trackLabelOffset}
          textHeight={textHeight}
          trackLabels={trackLabels}
          displayResults={displayResults}
          view={view}
          fontSize={fontSize}
          showGridlines={showGridlines}
          tracksHeight={tracksHeight}
        />
      </g>
    </g>
  )
}
