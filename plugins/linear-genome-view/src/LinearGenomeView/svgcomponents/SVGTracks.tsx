import React from 'react'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
// locals
import SVGRegionSeparators from './SVGRegionSeparators'
import SVGTrackLabel from './SVGTrackLabel'
import type { LinearGenomeViewModel } from '..'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

type LGV = LinearGenomeViewModel

interface DisplayResult {
  track: {
    configuration: AnyConfigurationModel
    displays: { height: number }[]
  }
  result: string
}

// SVG component, tracks
export default function SVGTracks({
  displayResults,
  model,
  textHeight,
  fontSize,
  trackLabels = 'offset',
  trackLabelOffset = 0,
}: {
  displayResults: DisplayResult[]
  model: LGV
  textHeight: number
  fontSize: number
  trackLabels?: string
  trackLabelOffset?: number
}) {
  const session = getSession(model)
  const textOffset = trackLabels === 'offset' ? textHeight : 0
  let offset = 0
  return (
    <>
      {displayResults.map(({ track, result }) => {
        const current = offset
        const conf = track.configuration
        const trackName = getTrackName(conf, session)
        const display = track.displays[0]!
        const x = Math.max(-model.offsetPx, 0)
        offset += display.height + textOffset
        return (
          <g key={conf.trackId} transform={`translate(0 ${current})`}>
            <g transform={`translate(${trackLabelOffset} ${textOffset})`}>
              <SVGRegionSeparators model={model} height={display.height} />
              {result}
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
