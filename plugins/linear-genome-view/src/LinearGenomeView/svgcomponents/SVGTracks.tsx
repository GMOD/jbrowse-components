import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

import SVGRegionSeparators from './SVGRegionSeparators.tsx'
import SVGTrackLabel from './SVGTrackLabel.tsx'
import { trackSpacing } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { TrackLabelMode } from '../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

type LGV = LinearGenomeViewModel

interface DisplayResult {
  track: {
    configuration: AnyConfigurationModel
    displays: { height: number }[]
  }
  result: React.ReactNode
}

export default function SVGTracks({
  displayResults,
  model,
  textHeight,
  fontSize,
  trackLabels = 'offset',
  trackLabelOffset = 0,
  leftBuffer = 0,
}: {
  displayResults: DisplayResult[]
  model: LGV
  textHeight: number
  fontSize: number
  trackLabels?: TrackLabelMode
  trackLabelOffset?: number
  leftBuffer?: number
}) {
  const session = getSession(model)
  const textOffset = trackLabels === 'offset' ? textHeight : 0
  const x = Math.max(-model.offsetPx, 0)
  let offset = 0
  return (
    <>
      {displayResults.map(({ track, result }) => {
        const conf = track.configuration
        const trackName = getTrackName(conf, session)
        const display = track.displays[0]!
        const clipId = `track-clip-${conf.trackId}`
        const currentOffset = offset
        offset += display.height + textOffset + trackSpacing
        return (
          <g key={conf.trackId} transform={`translate(0 ${currentOffset})`}>
            <defs>
              <clipPath id={clipId}>
                <rect
                  x={-leftBuffer}
                  y={textOffset}
                  width={model.width + trackLabelOffset + leftBuffer}
                  height={display.height}
                />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <g transform={`translate(${trackLabelOffset} ${textOffset})`}>
                <SVGRegionSeparators model={model} height={display.height} />
                {result}
              </g>
            </g>
            <SVGTrackLabel
              trackName={trackName}
              fontSize={fontSize}
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
