import SVGGridlines from './SVGGridlines.tsx'
import SVGHighlightsOverlay from './SVGHighlightsOverlay.tsx'
import SVGTracks from './SVGTracks.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type { TrackLabelMode } from '../types.ts'
import type { SvgDisplayResult } from './util.ts'
import type { ReactNode } from 'react'

// One LGV's worth of exported SVG: a caller-supplied header on top, then
// optional gridlines, the track bodies, and the highlight layer over them.
// Shared by all three exports that stack an LGV — the standalone one, and the
// linear-synteny and breakpoint-split rows — so their per-view layout can't
// drift. It did drift while the standalone export kept its own copy of these
// four groups: only that copy widened the per-track clip by `legendWidth`.
export default function SVGView({
  view,
  displayResults,
  header,
  fontSize,
  textHeight,
  trackLabels,
  trackLabelOffset,
  contentTop,
  tracksHeight,
  showGridlines,
  leftBuffer = 0,
  legendWidth = 0,
}: {
  view: LinearGenomeViewModel
  displayResults: SvgDisplayResult[]
  // What sits above the track bodies, drawn from this component's own origin
  // and inset by `trackLabelOffset` like everything else that lines up with the
  // genome. SVGRowHeader (assembly name + ruler) for a stacked row, SVGHeader
  // (which adds the cytoband overview and the total-bp scalebar) for the
  // standalone LGV export. A slot rather than a flag: the two differ in what
  // they draw *and* in how tall they are, and `contentTop` is where the caller
  // states the second half of that.
  header: ReactNode
  fontSize: number
  textHeight: number
  trackLabels: TrackLabelMode
  trackLabelOffset: number
  // Height of `header`, i.e. where the track bodies start. Callers that want
  // more space above a view put it above this component's origin (where a
  // header's assembly label floats), not in here — a gap inside would detach
  // the header from the tracks it labels.
  contentTop: number
  tracksHeight: number
  showGridlines: boolean
  // Left gutter the per-track clip should extend into, so left-of-zero content
  // (a wiggle Y-scalebar) isn't clipped. Callers that translate the whole view
  // by a margin pass that margin here.
  leftBuffer?: number
  // Right gutter the caller widened its canvas by for legends, so the per-track
  // clip reaches them. 0 for a stacked export, which has no room to give and
  // whose displays float their legends over the plot instead.
  legendWidth?: number
}) {
  return (
    <>
      <g transform={`translate(${trackLabelOffset})`}>{header}</g>
      {showGridlines ? (
        <g transform={`translate(${trackLabelOffset} ${contentTop})`}>
          <SVGGridlines model={view} height={tracksHeight} />
        </g>
      ) : null}
      <g transform={`translate(0 ${contentTop})`}>
        <SVGTracks
          textHeight={textHeight}
          trackLabels={trackLabels}
          fontSize={fontSize}
          model={view}
          displayResults={displayResults}
          trackLabelOffset={trackLabelOffset}
          leftBuffer={leftBuffer}
          legendWidth={legendWidth}
        />
      </g>
      {/*
        over the track bodies, as on screen and in the standalone LGV export.
        It lives here rather than in each caller because it is part of "one
        view's worth of export" — the breakpoint-split export dropped the
        user's highlights entirely for as long as it was the caller's job.
      */}
      <g transform={`translate(${trackLabelOffset} ${contentTop})`}>
        <SVGHighlightsOverlay model={view} tracksHeight={tracksHeight} />
      </g>
    </>
  )
}
