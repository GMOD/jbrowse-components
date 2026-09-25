import { exportMargin } from '@jbrowse/core/svg/constants'
import { awaitViewInitialized } from '@jbrowse/core/svg/svgReady'
import { notifySkippedSvgTracks } from '@jbrowse/core/svg/trackNames'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getSession } from '@jbrowse/core/util'

import SVGHeader from './SVGHeader.tsx'
import SVGView from './SVGView.tsx'
import { renderViewTracks } from './renderViewTracks.ts'
import {
  defaultTextHeight,
  getHeaderLayout,
  trackLabelLeftOffset,
} from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ExportSvgOptions } from '../types.ts'

type LGV = LinearGenomeViewModel

export async function renderToSvg(model: LGV, opts: ExportSvgOptions) {
  await awaitViewInitialized(model)
  // `initialized` only answers "have the assemblies loaded" — navigating is the
  // second async step, so an initialized view can still hold no regions: one
  // sitting on its import form, or one a `clearView` emptied. There is no
  // ruler, no scalebar and no track content to draw there, and the export used
  // to save the header's reserved height as a blank themed rectangle. Say why
  // instead, which the dialog shows as an error banner and a headless caller
  // (jbrowse-img) gets as a nonzero exit rather than a blank image. Same guard,
  // and the same reason, as the circular view's import-form export.
  if (!model.hasDisplayedRegions) {
    throw new Error('Cannot export: no regions are displayed')
  }
  const {
    fontSize = 13,
    // the label band scales with the font it holds; destructured after
    // fontSize so the default can read it
    textHeight = defaultTextHeight(fontSize),
    rulerHeight = 34,
    trackLabels = 'offset',
    themeName,
    fontFamily,
    showGridlines = false,
    Wrapper,
  } = opts
  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(themeName)

  // owns the two orderings this used to spell out by hand: legendWidth before
  // the awaits, tracksHeight after them. Every display's `renderSvg` owns its
  // own readiness wait — an LGV display through `renderDisplaySvg`'s
  // `awaitSvgReady`, a non-LGV one (dotplot, synteny, circular) by calling that
  // itself.
  const { tracks, displayResults, tracksHeight, legendWidth, skippedTracks } =
    await renderViewTracks({
      view: model,
      opts,
      theme,
      textHeight,
      trackLabels,
      // the standalone export is the one with room to give: it widens its
      // canvas below so a legend sits beside the plot rather than over it
      reserveLegendWidth: true,
    })
  notifySkippedSvgTracks(session, skippedTracks)

  // read after the displays' waits, and handed to SVGHeader rather than read
  // again, so the reserved `tracksTop` and the drawn header are one layout
  const { width, effectiveShowCytobands } = model
  const headerLayout = getHeaderLayout({
    fontSize,
    showCytobands: effectiveShowCytobands,
    rulerHeight,
  })
  const { tracksTop } = headerLayout
  const trackLabelOffset = trackLabelLeftOffset({
    tracks,
    trackLabels,
    fontSize,
    fontFamily,
    session,
  })
  const w = width + trackLabelOffset + legendWidth

  // the xlink namespace is used for rendering <image> tag
  return wrapSvgExport({
    theme,
    width: w,
    height: tracksTop + tracksHeight + exportMargin,
    fontFamily,
    Wrapper,
    children: (
      <g transform={`translate(${exportMargin} 0)`}>
        <SVGView
          view={model}
          displayResults={displayResults}
          // the standalone export is the one with room above the tracks, so its
          // header is the full one: cytoband overview and total-bp scalebar as
          // well as the assembly name and ruler. `tracksTop` is the height
          // getHeaderLayout gave it.
          header={
            <SVGHeader
              model={model}
              fontSize={fontSize}
              rulerHeight={rulerHeight}
              layout={headerLayout}
              showCytobands={effectiveShowCytobands}
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
          legendWidth={legendWidth}
        />
      </g>
    ),
  })
}
