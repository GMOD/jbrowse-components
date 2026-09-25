import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { exportMargin } from '@jbrowse/core/svg/constants'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import {
  awaitSvgRenders,
  awaitViewInitialized,
} from '@jbrowse/core/svg/svgReady'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { LEGEND_ROW_HEIGHT } from '@jbrowse/core/ui/SvgColorLegend'
import { getSession } from '@jbrowse/core/util'
import {
  SVGStackedRow,
  defaultTextHeight,
  getRowHeaderLayout,
  notifySkippedSvgTracks,
  renderViewTracks,
  trackLabelLeftOffset,
} from '@jbrowse/plugin-linear-genome-view'

import { SvgConnectionKey } from '../components/ConnectionKey.tsx'
import Overlay from '../components/Overlay.tsx'
import { connectionKeyRows } from '../components/connectionStyle.ts'
import { connectionKeyEntries } from '../components/overlayUtils.tsx'
import { getTrackOffsets } from './util.ts'

import type { BreakpointViewModel } from '../model.ts'
import type { ExportSvgOptions } from '../types.ts'

type BSV = BreakpointViewModel

// render LGV to SVG
export async function renderToSvg(model: BSV, opts: ExportSvgOptions) {
  await awaitViewInitialized(model)
  // The panels too: the split view's own launch turns its recipe into
  // sub-views and clears in the same tick, so `model.initialized` holds while
  // each panel's OWN launch — carrying its loc and, decisively, its tracks —
  // is still being applied. Reading `views` there exported correctly
  // positioned, correctly labelled, completely empty panels.
  await awaitSvgRenders(model.views.map(view => awaitViewInitialized(view)))
  const {
    fontSize = 13,
    // destructured after fontSize so the label band can scale with it
    textHeight = defaultTextHeight(fontSize),
    headerHeight = 30,
    rulerHeight = 30,
    trackLabels = 'offset',
    showGridlines = false,
    Wrapper,
    themeName,
    fontFamily,
  } = opts

  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(themeName)
  const { views } = model
  // EVERY ROW SAYS WHAT IT SPANS (review of jbrowse-img/sv_review_pair: "it
  // might be helpful to have scale indicators and/or trying to keep each row on
  // the same relative scale"). A breakpoint stack is N loci a reader compares
  // row against row, and whether two of them are at the same zoom was legible
  // only off the ruler coordinates — which is 10 px of text in an export that
  // gets published at a third of its rendered width. The bar and its span label
  // are the standalone LGV export's, drawn per row here.
  const rowHeader = getRowHeaderLayout({ fontSize, showScalebar: true })
  // each view is a header band (which the assembly label and the scalebar sit
  // in, and which separates the view from the one above) plus a ruler, stacked
  // above its track bodies. `offset` is where those bodies start within the
  // view. The band is the caller's to reserve, so it is the larger of what the
  // option asks for and what the header actually draws.
  const headerBand = Math.max(headerHeight, rowHeader.bandHeight)
  const offset = headerBand + rulerHeight
  // renderViewTracks drops minimized tracks (as the standalone LGV export does,
  // so a collapsed track doesn't export as a full-height panel) and measures
  // each row only once its displays have settled — which is what keeps the
  // reserved height, the rendered bodies and the ribbon anchors below in sync.
  // See the orderings it documents.
  const rowTracks = await awaitSvgRenders(
    views.map(view =>
      renderViewTracks({ view, opts, theme, textHeight, trackLabels }),
    ),
  )
  // one message for the whole stack, not one per row
  notifySkippedSvgTracks(
    session,
    rowTracks.flatMap(r => r.skippedTracks),
  )
  const heights = rowTracks.map(r => r.tracksHeight + offset)
  // after the waits: a resize during the fetch would otherwise size the canvas
  // and the overlay clip for the old width while SVGView re-reads the new one
  const { width } = model

  // one gutter for the whole export, wide enough for the widest label in any
  // view, so the stacked views stay aligned with each other
  const trackLabelOffset = trackLabelLeftOffset({
    tracks: rowTracks.flatMap(r => r.tracks),
    trackLabels,
    fontSize,
    fontFamily,
    session,
  })
  const w = width + trackLabelOffset

  // stack the views top to bottom: one running top offset positions each group,
  // anchors that view's overlay ribbons, and ends as the total content height,
  // so the canvas size, the rendered bodies and the ribbons share one source of
  // truth.
  // skip tracks minimized in any view: they have no rendered body to anchor a
  // ribbon to (getTrackOffsets omits them)
  const overlayTrackIds = model.overlayTracks
    .map(track => track.configuration.trackId)
    .filter(id =>
      rowTracks.every(r => r.tracks.some(t => t.configuration.trackId === id)),
    )
  const keyEntries = connectionKeyEntries(model, overlayTrackIds)
  const keyRows = connectionKeyRows(keyEntries).length
  const keyBand = keyRows > 0 ? keyRows * LEGEND_ROW_HEIGHT + 4 : 0
  let y = keyBand
  const rows = views.map((view, idx) => {
    const top = y
    y += heights[idx]!
    return {
      view,
      top,
      // The tracks of this view, keyed by trackId, in the coordinate space of
      // the overlay group below — which is why they carry the view's own top.
      trackOffsets: getTrackOffsets(
        rowTracks[idx]!.tracks,
        trackLabels,
        textHeight,
        top + offset,
      ),
    }
  })
  const totalHeightSvg = y + exportMargin

  // the xlink namespace is used for rendering <image> tag
  return wrapSvgExport({
    theme,
    width: w,
    height: totalHeightSvg,
    fontFamily,
    Wrapper,
    children: (
      <>
        {keyBand > 0 ? (
          <SvgConnectionKey
            entries={keyEntries}
            canvasWidth={w + exportMargin + 4}
          />
        ) : null}
        {rows.map(({ view, top }, idx) => (
          <SVGStackedRow
            key={view.id}
            view={view}
            rendered={rowTracks[idx]!}
            top={top + headerBand}
            margin={exportMargin}
            fontSize={fontSize}
            textHeight={textHeight}
            rulerHeight={rulerHeight}
            trackLabels={trackLabels}
            trackLabelOffset={trackLabelOffset}
            showGridlines={showGridlines}
            // Usually ONE assembly seen at several loci, so the name goes on
            // the first row and again wherever the assembly changes
            showAssemblyName={
              idx === 0 ||
              rows[idx - 1]!.view.assemblyNames.join(', ') !==
                view.assemblyNames.join(', ')
            }
            // every row: the span is what differs between rows
            showScalebar
          />
        ))}

        <g transform={`translate(${trackLabelOffset + exportMargin})`}>
          <SvgClipRect
            id={`clip-bsv-${svgNodeId(model)}`}
            width={width}
            height={totalHeightSvg}
          >
            {overlayTrackIds.map(id => (
              <Overlay
                key={id}
                model={model}
                trackId={id}
                yOffsetsOverride={rows.map(r => r.trackOffsets[id]!)}
              />
            ))}
          </SvgClipRect>
        </g>
      </>
    ),
  })
}
