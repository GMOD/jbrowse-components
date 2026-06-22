import { SVGExportRoot } from '@jbrowse/core/svg/SvgExport'
import { exportMargin } from '@jbrowse/core/svg/constants'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  getFillProps,
  getSession,
  renderToStaticMarkup,
  sum,
} from '@jbrowse/core/util'
import {
  SVGGridlines,
  SVGRuler,
  SVGTracks,
  totalHeight,
} from '@jbrowse/plugin-linear-genome-view'
import { ThemeProvider } from '@mui/material'
import { when } from 'mobx'

import { getTrackNameMaxLen, getTrackOffsets } from './util.ts'
import Overlay from '../components/Overlay.tsx'

import type { BreakpointViewModel } from '../model.ts'
import type { ExportSvgOptions } from '../types.ts'

type BSV = BreakpointViewModel

// render LGV to SVG
export async function renderToSvg(model: BSV, opts: ExportSvgOptions) {
  await when(() => model.initialized)
  const {
    textHeight = 18,
    headerHeight = 30,
    rulerHeight = 30,
    fontSize = 13,
    trackLabels = 'offset',
    showGridlines = false,
    Wrapper = ({ children }) => children,
    themeName = 'default',
  } = opts

  const session = getSession(model)
  const theme = session.allThemes?.()[themeName]
  const { width, views } = model
  const offset = headerHeight + rulerHeight
  const tracksHeights = views.map(v =>
    totalHeight(v.tracks, textHeight, trackLabels),
  )
  const heights = tracksHeights.map(h => h + offset)
  const totalHeightSvg = sum(heights) + 100
  const displayResults = await Promise.all(
    views.map(
      async view =>
        ({
          view,

          data: await Promise.all(
            view.tracks.map(async track => {
              const d = track.displays[0]
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
      fontSize + sum(heights.slice(0, idx)) + offset,
    ),
  )
  const w = width + trackLabelOffset
  const t = createJBrowseTheme(theme)

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <ThemeProvider theme={t}>
      <Wrapper>
        <SVGExportRoot width={w} height={totalHeightSvg}>
          {displayResults.map(({ view, data }, idx) => {
            const yOffset = fontSize + sum(heights.slice(0, idx))
            return (
              <g key={view.id} transform={`translate(${exportMargin} ${yOffset})`}>
                <g transform={`translate(${trackLabelOffset})`}>
                  <text
                    x={0}
                    fontSize={fontSize}
                    {...getFillProps(t.palette.text.primary)}
                  >
                    {view.assemblyNames.join(', ')}
                  </text>
                  <SVGRuler model={view} fontSize={fontSize} />
                </g>
                {showGridlines ? (
                  <g transform={`translate(${trackLabelOffset} ${offset})`}>
                    <SVGGridlines model={view} height={tracksHeights[idx]!} />
                  </g>
                ) : null}
                <g transform={`translate(0 ${offset})`}>
                  <SVGTracks
                    textHeight={textHeight}
                    trackLabels={trackLabels}
                    fontSize={fontSize}
                    model={view}
                    displayResults={data}
                    trackLabelOffset={trackLabelOffset}
                  />
                </g>
              </g>
            )
          })}

          <defs>
            <clipPath id="clip-bsv">
              <rect
                x={trackLabelOffset + exportMargin}
                y={0}
                width={width}
                height={totalHeightSvg}
              />
            </clipPath>
          </defs>
          <g
            transform={`translate(${trackLabelOffset + exportMargin})`}
            clipPath="url(#clip-bsv)"
          >
            {model.matchedTracks.map(track => {
              const id = track.configuration.trackId
              return (
                <Overlay
                  key={id}
                  model={model}
                  trackId={id}
                  yOffsetsOverride={trackOffsets.map(o => o[id]!)}
                />
              )
            })}
          </g>
        </SVGExportRoot>
      </Wrapper>
    </ThemeProvider>,
  )
}
