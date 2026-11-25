import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import {
  SvgLegend,
  exportedHeight,
} from '@jbrowse/display-kit/renderDisplaySvg'

import SVGRegionSeparators from './SVGRegionSeparators.tsx'
import SVGTrackLabel from './SVGTrackLabel.tsx'
import {
  labelOffset,
  trackBoxOffsets,
  trackLabelMode,
  trackLeftAxisWidth,
} from './util.ts'

import type { TrackLabelMode } from '../types.ts'
import type { LgvSvgChromeView, SvgTrackRow } from './util.ts'

interface TrackRowsLayout {
  textHeight: number
  fontSize: number
  trackLabels: TrackLabelMode
  trackLabelOffset: number
  leftBuffer: number
}

/** Each track's box, body, separators, key and label, over named rows. */
export function SVGTrackRows({
  rows,
  view,
  textHeight,
  fontSize,
  trackLabels,
  trackLabelOffset,
  leftBuffer,
}: TrackRowsLayout & {
  rows: SvgTrackRow[]
  view: LgvSvgChromeView
}) {
  const x = Math.max(-view.offsetPx, 0)
  const offsets = trackBoxOffsets(
    rows.map(r => r.track),
    trackLabels,
    textHeight,
  )
  return (
    <>
      {rows.map(({ trackId, name, track, result, legendHeight }, i) => {
        const display = track.displays[0]!
        const currentOffset = offsets[i]!
        const textOffset = labelOffset(track, trackLabels, textHeight)
        return (
          <g key={trackId} transform={`translate(0 ${currentOffset})`}>
            {/* the box is inset by `textOffset` (the label band above the
            body) and bleeds `leftBuffer` into the export's left gutter, so
            left-of-zero content like a wiggle Y-scalebar survives. The id
            carries a trackId — arbitrary config text landing inside a
            `url(#...)` — and SvgClipRect is what sanitizes it. */}
            <SvgClipRect
              id={`track-clip-${svgNodeId(view)}-${trackId}`}
              x={-leftBuffer}
              y={textOffset}
              width={view.width + trackLabelOffset + leftBuffer}
              height={exportedHeight(display)}
            >
              <g transform={`translate(${trackLabelOffset} ${textOffset})`}>
                {result}
                {/* the note covers the whole box, so a separator would only
                    strike through its text */}
                {display.regionTooLarge ? null : (
                  <SVGRegionSeparators
                    model={view}
                    height={exportedHeight(display)}
                  />
                )}
              </g>
            </SvgClipRect>
            {legendHeight === undefined ? null : (
              <g transform={`translate(${trackLabelOffset} ${textOffset})`}>
                <SvgLegend
                  model={display}
                  width={view.width}
                  height={legendHeight}
                />
              </g>
            )}
            <SVGTrackLabel
              trackName={name}
              fontSize={fontSize}
              textHeight={textHeight}
              trackLabels={trackLabelMode(track, trackLabels)}
              trackLabelOffset={trackLabelOffset}
              leftAxisWidth={trackLeftAxisWidth(track)}
              x={x + trackLabelOffset}
            />
          </g>
        )
      })}
    </>
  )
}
