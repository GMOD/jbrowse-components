import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { exportMargin } from '@jbrowse/core/svg/constants'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import {
  awaitSvgRenders,
  awaitViewInitialized,
} from '@jbrowse/core/svg/svgReady'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getSession } from '@jbrowse/core/util'
import {
  SVGRowHeader,
  SVGView,
  defaultTextHeight,
  getRowHeaderLayout,
  labelOffset,
  notifySkippedSvgTracks,
  renderViewTracks,
  trackLabelLeftOffset,
} from '@jbrowse/plugin-linear-genome-view'

import Overlay from '../components/Overlay.tsx'
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
  await Promise.all(model.views.map(view => awaitViewInitialized(view)))
  const {
    fontSize = 13,
    // destructured after fontSize so the label band can scale with it
    textHeight = defaultTextHeight(fontSize),
    headerHeight = 30,
    rulerHeight = 30,
    trackLabels = 'offset',
    showGridlines = false,
    Wrapper = ({ children }) => children,
    themeName = 'default',
    fontFamily,
  } = opts

  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(themeName)
  const { width, views } = model
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

  // one gutter for the whole export, wide enough for the widest label in any
  // view, so the stacked views stay aligned with each other
  const trackLabelOffset = trackLabelLeftOffset({
    tracks: rowTracks.flatMap(r => r.tracks),
    trackLabels,
    fontSize,
    fontFamily,
    session,
  })
  const textOffset = labelOffset(trackLabels, textHeight)
  const w = width + trackLabelOffset

  // stack the views top to bottom: one running top offset positions each group,
  // anchors that view's overlay ribbons, and ends as the total content height,
  // so the canvas size, the rendered bodies and the ribbons share one source of
  // truth.
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
        textOffset,
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
        {rows.map(({ view, top }, idx) => (
          <g
            key={view.id}
            // the assembly label and the scalebar sit in the header band above
            // the ruler (see SVGView), which is why the group starts that far
            // down
            transform={`translate(${exportMargin} ${top + headerBand})`}
          >
            <SVGView
              view={view}
              displayResults={rowTracks[idx]!.displayResults}
              header={
                <SVGRowHeader
                  view={view}
                  fontSize={fontSize}
                  rulerHeight={rulerHeight}
                  // A breakpoint split view is usually ONE assembly seen at
                  // several loci, so naming it per panel prints the same
                  // string once per row and says nothing. Named on the first
                  // row, and again on any row whose assembly differs from the
                  // one above it — so a cross-assembly stack still labels
                  // every change and this rule needs no flag.
                  showAssemblyName={
                    idx === 0 ||
                    rows[idx - 1]!.view.assemblyNames.join(', ') !==
                      view.assemblyNames.join(', ')
                  }
                  // every row, unlike the assembly name: the span is what
                  // differs between rows, so printing it once says nothing
                  showScalebar
                />
              }
              fontSize={fontSize}
              textHeight={textHeight}
              trackLabels={trackLabels}
              trackLabelOffset={trackLabelOffset}
              contentTop={rulerHeight}
              tracksHeight={rowTracks[idx]!.tracksHeight}
              showGridlines={showGridlines}
              leftBuffer={exportMargin}
            />
          </g>
        ))}

        <g transform={`translate(${trackLabelOffset + exportMargin})`}>
          <SvgClipRect
            id={`clip-bsv-${svgNodeId(model)}`}
            width={width}
            height={totalHeightSvg}
          >
            {model.matchedTracks
              .filter(track =>
                // skip tracks minimized in any view: they have no rendered body
                // to anchor a ribbon to (getTrackOffsets omits them)
                rows.every(
                  r =>
                    r.trackOffsets[track.configuration.trackId] !== undefined,
                ),
              )
              .map(track => {
                const id = track.configuration.trackId
                return (
                  <Overlay
                    key={id}
                    model={model}
                    trackId={id}
                    yOffsetsOverride={rows.map(r => r.trackOffsets[id]!)}
                  />
                )
              })}
          </SvgClipRect>
        </g>
      </>
    ),
  })
}
