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
    themeName = 'default',
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

  // The view geometry is read *after* the displays' waits, never before —
  // SVGHeader re-reads both of these when it renders (later still, inside
  // wrapSvgExport) and lays itself out with the same getHeaderLayout call, so a
  // value that moved during the awaits would leave the reserved `tracksTop` and
  // the drawn header describing different rows. Same rule the dotplot, circular
  // and synteny exports each shipped a violation of.
  const { width, effectiveShowCytobands } = model
  const { tracksTop } = getHeaderLayout({
    fontSize,
    showCytobands: effectiveShowCytobands,
    rulerHeight,
  })
  const height = tracksHeight + tracksTop + exportMargin

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
    height,
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
