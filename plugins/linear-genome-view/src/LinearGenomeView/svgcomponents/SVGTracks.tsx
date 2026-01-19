import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

import SVGRegionSeparators from './SVGRegionSeparators.tsx'
import SVGTrackLabel from './SVGTrackLabel.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
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
  return (
    <>
      {
        displayResults.reduce(
          ({ prevOffset, reactElements }, { track, result }) => {
            const conf = track.configuration
            const trackName = getTrackName(conf, session)
            const display = track.displays[0]!
            const x = Math.max(-model.offsetPx, 0)
            const currOffset = prevOffset + display.height + textOffset
            return {
              prevOffset: currOffset,
              reactElements: [
                ...reactElements,
                <g key={conf.trackId} transform={`translate(0 ${prevOffset})`}>
                  <g transform={`translate(${trackLabelOffset} ${textOffset})`}>
                    <SVGRegionSeparators
                      model={model}
                      height={display.height}
                    />
                    {result}
                  </g>
                  <SVGTrackLabel
                    trackName={trackName}
                    fontSize={fontSize}
                    trackLabels={trackLabels}
                    trackLabelOffset={trackLabelOffset}
                    x={x}
                  />
                </g>,
              ],
            }
          },
          {
            prevOffset: 0,
            reactElements: [] as React.ReactElement[],
          },
        ).reactElements
      }
    </>
  )
}
