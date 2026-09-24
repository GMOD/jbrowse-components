import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { svgTrackName } from '@jbrowse/core/svg/trackNames'
import { getSession } from '@jbrowse/core/util'
import { exportsTooLargeNote } from '@jbrowse/display-kit/renderDisplaySvg'

import SVGRegionSeparators from './SVGRegionSeparators.tsx'
import SVGTrackLabel from './SVGTrackLabel.tsx'
import { labelOffset, trackBoxOffsets, trackLabelMode } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { TrackLabelMode } from '../types.ts'
import type { SvgDisplayResult } from './util.ts'

type LGV = LinearGenomeViewModel

export default function SVGTracks({
  displayResults,
  model,
  textHeight,
  fontSize,
  trackLabels,
  trackLabelOffset,
  leftBuffer,
  legendWidth,
}: {
  displayResults: SvgDisplayResult[]
  model: LGV
  textHeight: number
  fontSize: number
  trackLabels: TrackLabelMode
  trackLabelOffset: number
  leftBuffer: number
  legendWidth: number
}) {
  const session = getSession(model)
  const x = Math.max(-model.offsetPx, 0)
  const offsets = trackBoxOffsets(
    displayResults.map(r => r.track),
    trackLabels,
    textHeight,
  )
  return (
    <>
      {displayResults.map(({ track, result }, i) => {
        const conf = track.configuration
        const trackName = svgTrackName(track, session)
        const display = track.displays[0]!
        const currentOffset = offsets[i]!
        const textOffset = labelOffset(track, trackLabels, textHeight)
        return (
          <g key={conf.trackId} transform={`translate(0 ${currentOffset})`}>
            {/* the box is inset by `textOffset` (the label band above the
            body) and bleeds `leftBuffer` into the export's left gutter, so
            left-of-zero content like a wiggle Y-scalebar survives. The id
            carries a trackId — arbitrary config text landing inside a
            `url(#...)` — and SvgClipRect is what sanitizes it. */}
            <SvgClipRect
              id={`track-clip-${svgNodeId(model)}-${conf.trackId}`}
              x={-leftBuffer}
              y={textOffset}
              width={model.width + trackLabelOffset + leftBuffer + legendWidth}
              height={display.height}
            >
              <g transform={`translate(${trackLabelOffset} ${textOffset})`}>
                {result}
                {/* the note covers the whole box, so a separator would only
                    strike through its text */}
                {exportsTooLargeNote(display) ? null : (
                  <SVGRegionSeparators model={model} height={display.height} />
                )}
              </g>
            </SvgClipRect>
            <SVGTrackLabel
              trackName={trackName}
              fontSize={fontSize}
              textHeight={textHeight}
              trackLabels={trackLabelMode(track, trackLabels)}
              trackLabelOffset={trackLabelOffset}
              x={x}
            />
          </g>
        )
      })}
    </>
  )
}
