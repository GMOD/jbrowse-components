import { exportMargin } from '@jbrowse/core/svg/constants'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'

import SVGHeader from './SVGHeader.tsx'
import { SVGViewChrome } from './SVGView.tsx'
import { layoutSvgTracks } from './renderViewTracks.ts'
import {
  defaultTextHeight,
  getHeaderLayout,
  trackLabelGutterWidth,
} from './util.ts'

import type { BandGap } from '../components/SVGHighlightBand.tsx'
import type { ExportSvgOptions } from '../types.ts'
import type { LgvSvgChromeView, SvgRowDisplay, SvgTrackRow } from './util.ts'
import type { ThemeOptions } from '@mui/material'
import type { ReactNode } from 'react'

/**
 * The text and layout settings of an LGV export with the view's defaults
 * filled in. The displays draw in the same `fontSize`, so a caller hands each
 * display's export these too.
 */
export function lgvSvgLayoutOptions(opts: ExportSvgOptions) {
  const {
    fontSize = 13,
    // the label band scales with the font it holds; destructured after
    // fontSize so the default can read it
    textHeight = defaultTextHeight(fontSize),
    rulerHeight = 34,
    trackLabels = 'offset',
    showGridlines = false,
  } = opts
  return { fontSize, textHeight, rulerHeight, trackLabels, showGridlines }
}

/**
 * One LGV's whole export document around its rendered rows: the header
 * (assembly name, scalebar, ruler), the label gutter, the track boxes, the
 * legend gutter and the highlight layer, laid out over `view`. The session's
 * `renderToSvg` calls it over its view and its rendered tracks; a static
 * export calls it over a `staticLgvFrame` and the bodies it drew. What only a
 * session has is a slot: `cytobands` draws the overview at the y it is given,
 * `highlights` inside the highlight layer's clip.
 */
export function lgvSvgDocument({
  view,
  rows,
  tracksHeight,
  legendWidth,
  theme,
  opts,
  cytobands,
  highlights,
}: {
  view: LgvSvgChromeView
  rows: SvgTrackRow[]
  tracksHeight: number
  legendWidth: number
  theme: ThemeOptions | undefined
  opts: ExportSvgOptions
  cytobands?: (y: number) => ReactNode
  highlights?: (gaps: BandGap[]) => ReactNode
}) {
  const { fontSize, textHeight, rulerHeight, trackLabels, showGridlines } =
    lgvSvgLayoutOptions(opts)
  const { fontFamily, Wrapper } = opts
  const headerLayout = getHeaderLayout({
    fontSize,
    showCytobands: cytobands !== undefined,
    rulerHeight,
  })
  const { tracksTop } = headerLayout
  const trackLabelOffset = trackLabelGutterWidth({
    rows,
    trackLabels,
    fontSize,
    fontFamily,
  })
  return wrapSvgExport({
    theme,
    width: view.width + trackLabelOffset + legendWidth,
    height: tracksTop + tracksHeight + exportMargin,
    fontFamily,
    Wrapper,
    children: (
      <g transform={`translate(${exportMargin} 0)`}>
        <SVGViewChrome
          view={view}
          rows={rows}
          highlights={highlights}
          // the standalone export is the one with room above the tracks, so
          // its header is the full one: cytoband overview and total-bp
          // scalebar as well as the assembly name and ruler. `tracksTop` is
          // the height getHeaderLayout gave it.
          header={
            <SVGHeader
              model={view}
              fontSize={fontSize}
              rulerHeight={rulerHeight}
              layout={headerLayout}
              cytobands={cytobands}
            />
          }
          fontSize={fontSize}
          textHeight={textHeight}
          trackLabels={trackLabels}
          trackLabelOffset={trackLabelOffset}
          contentTop={tracksTop}
          tracksHeight={tracksHeight}
          showGridlines={showGridlines}
          leftBuffer={exportMargin}
        />
      </g>
    ),
  })
}

/** A track a static export drew, as {@link staticLgvSvg} lays it out. */
export interface StaticLgvTrack {
  trackId: string
  /** the name drawn as its label, as plain text */
  name: string
  /** the display box its body was drawn in, legend members included */
  display: SvgRowDisplay
  body: ReactNode
}

/**
 * #api
 * A linear genome view's SVG export with no session: the chrome the view's
 * `renderToSvg` draws, over `view` (a `staticLgvFrame`) and the tracks a
 * static export drew in it, in order. Each body is drawn with
 * {@link lgvSvgLayoutOptions}' `fontSize`, as the view hands its displays.
 */
export function staticLgvSvg({
  view,
  tracks,
  theme,
  opts,
}: {
  view: LgvSvgChromeView
  tracks: StaticLgvTrack[]
  theme?: ThemeOptions
  opts: ExportSvgOptions
}) {
  const { textHeight, trackLabels } = lgvSvgLayoutOptions(opts)
  const rowTracks = tracks.map(t => ({ displays: [t.display] }))
  const { tracksHeight, legendHeights, legendWidth } = layoutSvgTracks({
    tracks: rowTracks,
    theme,
    textHeight,
    trackLabels,
  })
  return lgvSvgDocument({
    view,
    rows: tracks.map((t, i) => ({
      trackId: t.trackId,
      name: t.name,
      track: rowTracks[i]!,
      result: t.body,
      legendHeight: legendHeights[i],
    })),
    tracksHeight,
    legendWidth,
    theme,
    opts,
  })
}
