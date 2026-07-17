import { stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import SVGGridlines from './SVGGridlines.tsx'
import SVGRuler from './SVGRuler.tsx'
import SVGTracks from './SVGTracks.tsx'

import type { SvgDisplayResult } from './util.ts'
import type { LinearGenomeViewModel } from '../index.ts'
import type { TrackLabelMode } from '../types.ts'

// One LGV's worth of exported SVG: assembly label + ruler on top, then optional
// gridlines and the track bodies. Shared verbatim by the linear-synteny and
// breakpoint-split exports so their per-view layout can't drift; `contentTop` is
// where the tracks start below the ruler (the two callers reserve different
// header heights).
export default function SVGView({
  view,
  displayResults,
  fontSize,
  textHeight,
  trackLabels,
  trackLabelOffset,
  contentTop,
  rulerHeight = contentTop,
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
  contentTop: number
  // The ruler's own content budget, when it's smaller than the full
  // contentTop gap (e.g. breakpoint-split reserves extra header padding
  // above contentTop that the ruler doesn't use). Defaults to contentTop.
  rulerHeight?: number
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
        <SVGRuler model={view} fontSize={fontSize} rulerHeight={rulerHeight} />
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
    </>
  )
}
