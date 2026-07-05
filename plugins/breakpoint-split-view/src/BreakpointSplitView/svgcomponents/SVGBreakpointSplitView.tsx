import { exportMargin } from '@jbrowse/core/svg/constants'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getSession, sum } from '@jbrowse/core/util'
import { SVGView, totalHeight } from '@jbrowse/plugin-linear-genome-view'
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
  const theme = session.getActiveThemeOptions?.(themeName)
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

  // the xlink namespace is used for rendering <image> tag
  return wrapSvgExport({
    theme,
    width: w,
    height: totalHeightSvg,
    Wrapper,
    children: (
      <>
        {displayResults.map(({ view, data }, idx) => {
          const yOffset = fontSize + sum(heights.slice(0, idx))
          return (
            <g
              key={view.id}
              transform={`translate(${exportMargin} ${yOffset})`}
            >
              <SVGView
                view={view}
                displayResults={data}
                fontSize={fontSize}
                textHeight={textHeight}
                trackLabels={trackLabels}
                trackLabelOffset={trackLabelOffset}
                contentTop={offset}
                tracksHeight={tracksHeights[idx]!}
                showGridlines={showGridlines}
              />
            </g>
          )
        })}

        <defs>
          <clipPath id={`clip-bsv-${model.id}`}>
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
          clipPath={`url(#clip-bsv-${model.id})`}
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
      </>
    ),
  })
}
