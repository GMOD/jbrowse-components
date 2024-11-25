import React from 'react'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getSession, renderToStaticMarkup, sum } from '@jbrowse/core/util'
import {
  SVGTracks,
  SVGRuler,
  totalHeight,
} from '@jbrowse/plugin-linear-genome-view'
import { ThemeProvider } from '@mui/material'
import { when } from 'mobx'
import { getRoot } from 'mobx-state-tree'

// locals
import SVGBackground from './SVGBackground'
import { getTrackNameMaxLen, getTrackOffsets } from './util'
import Overlay from '../components/Overlay'
import type { ExportSvgOptions, BreakpointViewModel } from '../model'

type BSV = BreakpointViewModel

// render LGV to SVG
export async function renderToSvg(model: BSV, opts: ExportSvgOptions) {
  const {
    textHeight = 18,
    headerHeight = 30,
    rulerHeight = 30,
    fontSize = 13,
    trackLabels = 'offset',
    Wrapper = ({ children }) => children,
    themeName = 'default',
  } = opts

  const { createRootFn } = getRoot<any>(model)
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
        }) as const,
    ),
  )

  const trackLabelMaxLen = getTrackNameMaxLen(views, fontSize, session) + 40
  const trackLabelOffset = trackLabels === 'left' ? trackLabelMaxLen : 0
  const textOffset = trackLabels === 'offset' ? textHeight : 0
  const trackOffsets = views.map((view, idx) =>
    getTrackOffsets(
      view,
      textOffset,
      fontSize + (idx > 0 ? heights[idx - 1]! : 0) + offset,
    ),
  )
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
          {views[0] ? (
            <g transform={`translate(${shift} ${fontSize})`}>
              <g transform={`translate(${trackLabelOffset})`}>
                <text x={0} fontSize={fontSize} fill={t.palette.text.primary}>
                  {views[0].assemblyNames.join(', ')}
                </text>

                <SVGRuler model={displayResults[0]!.view} fontSize={fontSize} />
              </g>
              <g transform={`translate(0 ${offset})`}>
                <SVGTracks
                  textHeight={textHeight}
                  trackLabels={trackLabels}
                  fontSize={fontSize}
                  model={displayResults[0]!.view}
                  displayResults={displayResults[0]!.data}
                  trackLabelOffset={trackLabelOffset}
                />
              </g>
            </g>
          ) : null}

          {views[1] ? (
            <g transform={`translate(${shift} ${fontSize + heights[0]!})`}>
              <g transform={`translate(${trackLabelOffset})`}>
                <text x={0} fontSize={fontSize} fill={t.palette.text.primary}>
                  {views[1].assemblyNames.join(', ')}
                </text>
                <SVGRuler model={displayResults[1]!.view} fontSize={fontSize} />
              </g>
              <g transform={`translate(0 ${offset})`}>
                <SVGTracks
                  textHeight={textHeight}
                  trackLabels={trackLabels}
                  fontSize={fontSize}
                  model={displayResults[1]!.view}
                  displayResults={displayResults[1]!.data}
                  trackLabelOffset={trackLabelOffset}
                />
              </g>
            </g>
          ) : null}

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
                getTrackYPosOverride={(id, level) => trackOffsets[level]![id]!}
              />
            ))}
          </g>
        </svg>
      </Wrapper>
    </ThemeProvider>,
    createRootFn,
  )
}
