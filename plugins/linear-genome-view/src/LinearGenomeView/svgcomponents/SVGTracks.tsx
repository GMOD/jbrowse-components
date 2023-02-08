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
  paddingHeight,
  textHeight,
  fontSize,
}: {
  displayResults: DisplayResult[]
  model: LGV
  offset: number
  paddingHeight: number
  textHeight: number
  fontSize: number
}) {
  const theme = useTheme()
  const session = getSession(model)
  return (
    <>
      {displayResults.map(({ track, result }) => {
        const current = offset
        const trackName = getTrackName(track.configuration, session)

        const display = track.displays[0]
        offset += display.height + paddingHeight + textHeight
        return (
          <g
            key={track.configuration.trackId}
            transform={`translate(0 ${current})`}
          >
            <text
              fontSize={fontSize}
              x={Math.max(-model.offsetPx, 0)}
              fill={theme.palette.text.primary}
            >
              {trackName}
            </text>
            <g transform={`translate(0 ${textHeight})`}>
              {result}
              <SVGRegionSeparators model={model} height={display.height} />
            </g>
          </g>
        )
      })}
    </>
  )
}
