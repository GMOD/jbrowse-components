import React from 'react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { getSession } from '@jbrowse/core/util'
// locals
import { LinearGenomeViewModel } from '..'
import SVGRegionSeparators from './SVGRegionSeparators'
import SVGTrackLabel from './SVGTrackLabel'

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
  offset,
  textHeight,
  fontSize,
  trackLabels = 'offset',
  trackLabelOffset = 0,
}: {
  displayResults: DisplayResult[]
  model: LGV
  offset: number
  textHeight: number
  fontSize: number
  trackLabels?: string
  trackLabelOffset?: number
}) {
  const session = getSession(model)
  const textOffset = trackLabels === 'offset' ? textHeight : 0
  return (
    <>
      {displayResults.map(({ track, result }) => {
        const current = offset
        const conf = track.configuration
        const trackName = getTrackName(conf, session)
        const display = track.displays[0]
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
