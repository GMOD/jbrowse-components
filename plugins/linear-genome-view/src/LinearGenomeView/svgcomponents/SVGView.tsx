import { stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import SVGGridlines from './SVGGridlines.tsx'
import SVGHighlightsOverlay from './SVGHighlightsOverlay.tsx'
import SVGRuler from './SVGRuler.tsx'
import SVGTracks from './SVGTracks.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type { TrackLabelMode } from '../types.ts'
import type { SvgDisplayResult } from './util.ts'

// One LGV's worth of exported SVG: assembly label + ruler on top, then optional
// gridlines, the track bodies, and the highlight layer over them. Shared
// verbatim by the linear-synteny and breakpoint-split exports so their per-view
// layout can't drift.
export default function SVGView({
  view,
  displayResults,
  fontSize,
  textHeight,
  trackLabels,
  trackLabelOffset,
  contentTop,
  tracksHeight,
  showGridlines,
  leftBuffer = 0,
}: {
  view: LinearGenomeViewModel
  displayResults: SvgDisplayResult[]
  fontSize: number
  textHeight: number
  trackLabels: TrackLabelMode
  trackLabelOffset: number
  // Where the track bodies start, i.e. the ruler's height: the ruler hangs its
  // ticks off the bottom of this budget so they meet the tracks. Callers that
  // want more space above a view put it above this component's origin (where
  // the assembly label floats), not in here — a gap inside would detach the
  // ruler from the tracks it labels.
  contentTop: number
  tracksHeight: number
  showGridlines: boolean
  // Left gutter the per-track clip should extend into, so left-of-zero content
  // (a wiggle Y-scalebar) isn't clipped. Callers that translate the whole view
  // by a margin pass that margin here.
  leftBuffer?: number
}) {
  const theme = useTheme()
  return (
    <>
      <g transform={`translate(${trackLabelOffset})`}>
        {/*
          This group's origin (y=0) is the top of the ruler. The assembly label
          uses the default alphabetic baseline (glyphs ascend above y=0) so it
          floats into the fontSize-tall band that the caller reserves *above*
          this group — synteny/breakpoint each offset the whole view by
          +fontSize for exactly this. Don't switch to dominantBaseline="hanging"
          without also reworking those callers' offsets, or the label collides
          with the ruler.
        */}
        <text
          x={0}
          fontSize={fontSize}
          fill={stripAlpha(theme.palette.text.primary)}
        >
          {view.assemblyNames.join(', ')}
        </text>
        <SVGRuler model={view} rulerHeight={contentTop} />
      </g>
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
