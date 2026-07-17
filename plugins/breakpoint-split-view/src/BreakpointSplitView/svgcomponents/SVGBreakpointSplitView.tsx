import { exportMargin } from '@jbrowse/core/svg/constants'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getSession, sum } from '@jbrowse/core/util'
import {
  SVGView,
  totalHeight,
  trackLabelLeftOffset,
} from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import { getTrackOffsets } from './util.ts'
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
    fontFamily,
  } = opts

  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(themeName)
  const { width, views } = model
  const offset = headerHeight + rulerHeight
  // Minimized tracks are dropped (as the standalone LGV export does) so reserved
  // height, rendered bodies, label width, and overlay offsets stay in sync and a
  // collapsed track doesn't export as a full-height panel.
  const visibleTracksByView = views.map(v => v.tracks.filter(t => !t.minimized))
  const tracksHeights = visibleTracksByView.map(tracks =>
    totalHeight(tracks, textHeight, trackLabels),
  )
  const heights = tracksHeights.map(h => h + offset)
  const totalHeightSvg = sum(heights) + exportMargin
  const displayResults = await Promise.all(
    views.map(
      async (view, idx) =>
        ({
          view,

          data: await Promise.all(
            visibleTracksByView[idx]!.map(async track => {
              const d = track.displays[0]
              return { track, result: await d.renderSvg({ ...opts, theme }) }
            }),
          ),
        }) as const,
    ),
  )

  const trackLabelOffset = trackLabelLeftOffset({
    tracks: visibleTracksByView.flat(),
    trackLabels,
    fontSize,
    session,
  })
  const textOffset = trackLabels === 'offset' ? textHeight : 0
  const trackOffsets = visibleTracksByView.map((tracks, idx) =>
    getTrackOffsets(
      tracks,
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
    fontFamily,
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
                rulerHeight={rulerHeight}
                tracksHeight={tracksHeights[idx]!}
                showGridlines={showGridlines}
                leftBuffer={exportMargin}
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
          {model.matchedTracks
            .filter(track =>
              // skip tracks minimized in any view: they have no rendered body
              // to anchor a ribbon to (getTrackOffsets omits them)
              trackOffsets.every(
                o => o[track.configuration.trackId] !== undefined,
              ),
            )
            .map(track => {
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
