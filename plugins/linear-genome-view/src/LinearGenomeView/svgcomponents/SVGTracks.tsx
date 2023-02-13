import React from 'react'
import { useTheme } from '@mui/material'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { getSession } from '@jbrowse/core/util'
// locals
import { LinearGenomeViewModel } from '..'
import SVGRegionSeparators from './SVGRegionSeparators'

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
  const theme = useTheme()
  const session = getSession(model)
  const textOffset = trackLabels === 'offset' ? textHeight : 0
  const fill = theme.palette.text.primary
  return (
    <>
      {displayResults.map(({ track, result }) => {
        const current = offset
        const trackName = getTrackName(track.configuration, session)
        const display = track.displays[0]
        const x = Math.max(-model.offsetPx, 0)
        offset += display.height + textOffset
        return (
          <g
            key={track.configuration.trackId}
            transform={`translate(0 ${current})`}
          >
            {trackLabels !== 'none' ? (
              <text x={x} y={fontSize + 2} fill={fill} fontSize={fontSize}>
                {trackName}
              </text>
            ) : null}

            <g transform={`translate(${trackLabelOffset} ${textOffset})`}>
              {result}
              <SVGRegionSeparators model={model} height={display.height} />
            </g>
          </g>
        )
      })}
    </>
  )
}
