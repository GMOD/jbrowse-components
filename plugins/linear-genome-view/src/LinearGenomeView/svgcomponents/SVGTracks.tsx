import { getSession } from '@jbrowse/core/util'

import SVGRegionSeparators from './SVGRegionSeparators.tsx'
import SVGTrackLabel from './SVGTrackLabel.tsx'
import { labelOffset, svgTrackName, trackBoxOffsets } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { TrackLabelMode } from '../types.ts'
import type { SvgDisplayResult } from './util.ts'

type LGV = LinearGenomeViewModel

export default function SVGTracks({
  displayResults,
  model,
  textHeight,
  fontSize,
  trackLabels = 'offset',
  trackLabelOffset = 0,
  leftBuffer = 0,
  legendWidth = 0,
}: {
  displayResults: SvgDisplayResult[]
  model: LGV
  textHeight: number
  fontSize: number
  trackLabels?: TrackLabelMode
  trackLabelOffset?: number
  leftBuffer?: number
  legendWidth?: number
}) {
  const session = getSession(model)
  const textOffset = labelOffset(trackLabels, textHeight)
  const x = Math.max(-model.offsetPx, 0)
  const offsets = trackBoxOffsets(
    displayResults.map(r => r.track),
    textOffset,
  )
  return (
    <>
      {displayResults.map(({ track, result }, i) => {
        const conf = track.configuration
        const trackName = svgTrackName(track, session)
        const display = track.displays[0]!
        const clipId = `track-clip-${model.id}-${conf.trackId}`
        const currentOffset = offsets[i]!
        return (
          <g key={conf.trackId} transform={`translate(0 ${currentOffset})`}>
            <defs>
              <clipPath id={clipId}>
                <rect
                  x={-leftBuffer}
                  y={textOffset}
                  width={
                    model.width + trackLabelOffset + leftBuffer + legendWidth
                  }
                  height={display.height}
                />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <g transform={`translate(${trackLabelOffset} ${textOffset})`}>
                {result}
                <SVGRegionSeparators model={model} height={display.height} />
              </g>
            </g>
            <SVGTrackLabel
              trackName={trackName}
              fontSize={fontSize}
              textHeight={textHeight}
              trackLabels={trackLabels}
              trackLabelOffset={trackLabelOffset}
              x={x}
            />
          </g>
        )
      })}
    </>
  )
}
