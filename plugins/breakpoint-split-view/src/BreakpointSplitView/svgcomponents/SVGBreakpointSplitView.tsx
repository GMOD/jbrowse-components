import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { when } from 'mobx'
import {
  AbstractSessionModel,
  getSession,
  max,
  measureText,
  sum,
} from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { createJBrowseTheme } from '@jbrowse/core/ui'

// locals
import {
  SVGTracks,
  SVGRuler,
  totalHeight,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// locals
import SVGBackground from './SVGBackground'
import { ExportSvgOptions, BreakpointViewModel } from '../model'
import { getTrackName } from '@jbrowse/core/util/tracks'
import Overlay from '../components/Overlay'

type BSV = BreakpointViewModel

function getTrackNameMaxLen(
  views: LinearGenomeViewModel[],
  fontSize: number,
  session: AbstractSessionModel,
) {
  return max(
    views.flatMap(view =>
      view.tracks.map(t =>
        measureText(getTrackName(t.configuration, session), fontSize),
      ),
    ),
    0,
  )
}
function getTrackOffsets(
  view: LinearGenomeViewModel,
  textOffset: number,
  extra = 0,
) {
  const offsets = {} as { [key: string]: number }
  let curr = textOffset
  for (let i = 0; i < view.tracks.length; i++) {
    const track = view.tracks[i]
    offsets[track.configuration.trackId] = curr + extra
    curr += track.displays[0].height + textOffset
  }
  return offsets
}

// render LGV to SVG
export async function renderToSvg(model: BSV, opts: ExportSvgOptions) {
  const {
    textHeight = 18,
    headerHeight = 30,
    rulerHeight = 30,
    fontSize = 13,
    trackLabels = 'offset',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Wrapper = ({ children }: any) => <>{children}</>,
    themeName = 'default',
  } = opts
  const session = getSession(model)
  const theme = session.allThemes?.()[themeName]
  const { width, views } = model
  const shift = 50
  const offset = headerHeight + rulerHeight

  const heights = views.map(
    v => totalHeight(v.tracks, textHeight, trackLabels) + offset,
  )
  const totalHeightSvg = sum(heights) + 100
  const displayResults = await Promise.all(
    views.map(
      async view =>
        ({
          view,
          data: await Promise.all(
            view.tracks.map(async track => {
              const d = track.displays[0]
              await when(() => (d.ready !== undefined ? d.ready : true))
              return { track, result: await d.renderSvg({ ...opts, theme }) }
            }),
          ),
        } as const),
    ),
  )

  const trackLabelMaxLen = getTrackNameMaxLen(views, fontSize, session) + 40
  const trackLabelOffset = trackLabels === 'left' ? trackLabelMaxLen : 0
  const textOffset = trackLabels === 'offset' ? textHeight : 0
  const trackOffsets = [
    getTrackOffsets(views[0], textOffset, fontSize + offset),
    getTrackOffsets(views[1], textOffset, fontSize + heights[0] + offset),
  ]
  const w = width + trackLabelOffset
  const t = createJBrowseTheme(theme)

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <ThemeProvider theme={t}>
      <Wrapper>
        <svg
          width={width}
          height={totalHeightSvg}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox={[0, 0, w + shift * 2, totalHeightSvg].toString()}
        >
          <SVGBackground width={w} height={totalHeightSvg} shift={shift} />
          <g transform={`translate(${shift} ${fontSize})`}>
            <g transform={`translate(${trackLabelOffset})`}>
              <text x={0} fontSize={fontSize} fill={t.palette.text.primary}>
                {views[0].assemblyNames.join(', ')}
              </text>

              <SVGRuler model={displayResults[0].view} fontSize={fontSize} />
            </g>
            <SVGTracks
              textHeight={textHeight}
              trackLabels={trackLabels}
              fontSize={fontSize}
              model={displayResults[0].view}
              displayResults={displayResults[0].data}
              offset={offset}
              trackLabelOffset={trackLabelOffset}
            />
          </g>

          <g transform={`translate(${shift} ${fontSize + heights[0]})`}>
            <g transform={`translate(${trackLabelOffset})`}>
              <text x={0} fontSize={fontSize} fill={t.palette.text.primary}>
                {views[1].assemblyNames.join(', ')}
              </text>
              <SVGRuler model={displayResults[1].view} fontSize={fontSize} />
            </g>
            <SVGTracks
              textHeight={textHeight}
              trackLabels={trackLabels}
              fontSize={fontSize}
              model={displayResults[1].view}
              displayResults={displayResults[1].data}
              offset={offset}
              trackLabelOffset={trackLabelOffset}
            />
          </g>

          <defs>
            <clipPath id="clip-bsv">
              <rect x={0} y={0} width={width} height={totalHeightSvg} />
            </clipPath>
          </defs>
          <g
            transform={`translate(${trackLabelOffset + shift})`}
            clipPath="url(#clip-bsv)"
          >
            {model.matchedTracks.map(track => (
              <Overlay
                parentRef={{ current: null }}
                key={track.configuration.trackId}
                model={model}
                trackId={track.configuration.trackId}
                getTrackYPosOverride={(id, level) => trackOffsets[level][id]}
              />
            ))}
          </g>
        </svg>
      </Wrapper>
    </ThemeProvider>,
  )
}
