import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { parsePhysicalWidth } from '@jbrowse/core/svg/figureSize'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import {
  awaitSvgReady,
  awaitSvgRenders,
  awaitViewInitialized,
} from '@jbrowse/core/svg/svgReady'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getSession, max } from '@jbrowse/core/util'
import {
  SVGStackedRow,
  exportMargins,
  getRowHeaderLayout,
  lgvSvgLayoutOptions,
  notifySkippedSvgTracks,
  renderViewTracks,
  trackLabelLeftOffset,
} from '@jbrowse/plugin-linear-genome-view'

import { SvgConnectionKey } from '../components/ConnectionKey.tsx'
import Overlay from '../components/Overlay.tsx'
import {
  CONNECTION_KEY_INSET,
  exportedConnectionKey,
  exportedOverlayTrackIds,
} from './pageSubject.ts'
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
  const { Wrapper, themeName, fontFamily } = opts
  const { fontSize, textHeight, rulerHeight, trackLabels, showGridlines } =
    lgvSvgLayoutOptions(opts)

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
  // view.
  const headerBand = rowHeader.bandHeight
  const offset = headerBand + rulerHeight
  // renderViewTracks drops minimized tracks (as the standalone LGV export does,
  // so a collapsed track doesn't export as a full-height panel) and measures
  // each row only once its displays have settled — which is what keeps the
  // reserved height, the rendered bodies and the ribbon anchors below in sync.
  // See the orderings it documents.
  const rowTracks = await awaitSvgRenders(
    views.map(view =>
      renderViewTracks({
        view,
        opts: { ...opts, fontSize },
        theme,
        textHeight,
        trackLabels,
      }),
    ),
  )
  await awaitSvgReady({
    get svgReady() {
      return model.overlaySvgReady
    },
    get error() {
      return model.overlayError
    },
  })
  // one message for the whole stack, not one per row
  if (opts.announceSkipped !== false) {
    notifySkippedSvgTracks(
      session,
      rowTracks.flatMap(r => r.skippedTracks),
    )
  }
  const heights = rowTracks.map(r => r.tracksHeight + offset)
  // after the waits: a resize during the fetch would otherwise size the canvas
  // and the overlay clip for the old width while SVGView re-reads the new one.
  // The panels' width, which every initialized panel has been handed.
  const width = max(
    views.map(v => v.width),
    0,
  )

  // one gutter for the whole export, wide enough for the widest label in any
  // view, so the stacked views stay aligned with each other
  const trackLabelOffset = trackLabelLeftOffset({
    tracks: rowTracks.flatMap(r => r.tracks),
    trackLabels,
    fontSize,
    fontFamily,
    session,
  })
  // the connection key sits beside the first row and each track's key beside
  // its track, all in one gutter right of the stack
  const key = exportedConnectionKey(model, theme, opts)
  const w =
    width +
    trackLabelOffset +
    max([...rowTracks.map(r => r.legendWidth), key.gutterWidth], 0)
  const physicalWidth = parsePhysicalWidth(opts.pageWidth ?? '')
  const margins = exportMargins(
    rowTracks.flatMap(r => r.tracks.map(track => track.displays[0]!)),
    physicalWidth !== undefined,
  )

  // stack the views top to bottom: one running top offset positions each group,
  // anchors that view's overlay ribbons, and ends as the total content height,
  // so the canvas size, the rendered bodies and the ribbons share one source of
  // truth.
  // The overlay skips every pair touching a row where its track is minimized.
  const overlayTrackIds = exportedOverlayTrackIds(model)
  let y = 0
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
  const totalHeightSvg = y + margins.bottom

  // the xlink namespace is used for rendering <image> tag
  return wrapSvgExport({
    theme,
    width: margins.left + w + margins.right,
    height: totalHeightSvg,
    margin: 0,
    fontFamily,
    physicalWidth,
    Wrapper,
    children: (
      <>
        <SvgConnectionKey
          rows={key.rows}
          x={margins.left + trackLabelOffset + width + CONNECTION_KEY_INSET}
          maxHeight={key.maxHeight}
        />
        {rows.map(({ view, top }, idx) => (
          <SVGStackedRow
            key={view.id}
            view={view}
            rendered={rowTracks[idx]!}
            top={top + headerBand}
            margin={margins.left}
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

        <g transform={`translate(${trackLabelOffset + margins.left})`}>
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
                yOffsetsOverride={rows.map(r => r.trackOffsets[id])}
              />
            ))}
          </SvgClipRect>
        </g>
      </>
    ),
  })
}
