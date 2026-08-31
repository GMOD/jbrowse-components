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
  labelBaselineFromTop,
  notifySkippedSvgTracks,
  renderViewTracks,
  trackLabelLeftOffset,
} from '@jbrowse/plugin-linear-genome-view'
import { SVGColorByLegend } from '@jbrowse/synteny-core'

import { renderSvg as renderSyntenyDisplaySvg } from '../../LinearSyntenyDisplay/renderSvg.tsx'
import SVGOffscreenMates from './SVGOffscreenMates.tsx'
import SVGSyntenyLevel from './SVGSyntenyLevel.tsx'

import type { LinearSyntenyViewHelperModel } from '../../LinearSyntenyViewHelper/stateModelFactory.ts'
import type { LinearSyntenyViewModel } from '../model.ts'
import type { ExportSvgOptions } from '../types.ts'

// render a LinearSyntenyView to SVG: N stacked genome views with the synteny
// ribbon level for each adjacent pair between them
export async function renderToSvg(
  model: LinearSyntenyViewModel,
  opts: ExportSvgOptions,
) {
  await awaitViewInitialized(model)
  const {
    fontSize = 13,
    // destructured after fontSize so the label band can scale with it
    textHeight = defaultTextHeight(fontSize),
    rulerHeight = 30,
    trackLabels = 'offset',
    showGridlines = false,
    Wrapper,
    themeName = 'default',
    fontFamily,
  } = opts
  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(themeName)
  const { views, levels } = model

  // Clearance between a row and whatever sits above it. A row starts with its
  // assembly label, and the ribbon band above it is a solid block of colour, so
  // without this the label's ascenders begin on the band's last pixel and the
  // name reads as part of the ribbons. The first row keeps the flush top edge
  // that every export's assembly label hangs from.
  const rowTopGap = 6

  // each display's renderSvg owns its own readiness wait (LGV track displays
  // await their byte estimate internally, renderSyntenyDisplaySvg awaits
  // featureData/error), so no outer when() gate is needed here. The genome-view
  // track results and the ribbon levels are independent, so let both fan out
  // concurrently rather than blocking one behind the other.
  //
  // `awaitSvgRenders` at every level of that fan-out rather than `Promise.all`:
  // a track whose data won't load fails the export instead of drawing itself
  // into the figure, and this export has more places for one to hide than any
  // other — N genome views of tracks, N-1 levels of ribbons. It flattens nested
  // failures, so one export names every broken track across all of them.
  const [rowTracks, renderings] = await awaitSvgRenders([
    // renderViewTracks drops minimized tracks and measures each row only once
    // its displays have settled — see the orderings it documents
    awaitSvgRenders(
      views.map(view =>
        renderViewTracks({ view, opts, theme, textHeight, trackLabels }),
      ),
    ),
    awaitSvgRenders(
      levels.map(level =>
        awaitSvgRenders(
          level.linearSyntenyDisplays.map(async d => ({
            key: d.id,
            node: await renderSyntenyDisplaySvg(d, opts),
          })),
        ),
      ),
    ),
  ])

  // one message for the whole stack, not one per row
  notifySkippedSvgTracks(
    session,
    rowTracks.flatMap(r => r.skippedTracks),
  )

  // Deliberately read after those waits, not before. SVGView and each ribbon
  // layer re-read the view geometry for themselves once their own waits resolve,
  // so a resize landing during the fetch left the canvas, the level clips and
  // the legend sized for the pre-wait width while the rows and ribbons were
  // drawn against the new one. (Same ordering rule as the LGV export's track
  // heights.)
  const { width } = model

  // one gutter for the whole export, wide enough for the widest label in any
  // row, so the rows stay vertically aligned with each other
  const trackLabelOffset = trackLabelLeftOffset({
    tracks: rowTracks.flatMap(r => r.tracks),
    trackLabels,
    fontSize,
    fontFamily,
    session,
  })
  const w = width + trackLabelOffset

  // The export is a vertical stack, top to bottom: each genome view, and
  // directly beneath it the synteny ribbon level between it and the next view.
  // The last view has no level below it (N views -> N-1 levels), so `levels[i]`
  // is the single source of that invariant — no index bookkeeping in the layout.
  const rows = views.flatMap((view, i) => {
    // SVGView draws the assembly label on the alphabetic baseline at its own
    // origin, so the group starts at that baseline and the label's ink box
    // occupies the band above it
    const labelBaselineY = labelBaselineFromTop(
      i === 0 ? 0 : rowTopGap,
      fontSize,
    )
    const viewRow = {
      key: view.id,
      height: labelBaselineY + rulerHeight + rowTracks[i]!.tracksHeight,
      node: (
        <g transform={`translate(${exportMargin} ${labelBaselineY})`}>
          <SVGView
            view={view}
            displayResults={rowTracks[i]!.displayResults}
            header={
              <SVGRowHeader
                view={view}
                fontSize={fontSize}
                rulerHeight={rulerHeight}
              />
            }
            fontSize={fontSize}
            textHeight={textHeight}
            trackLabels={trackLabels}
            trackLabelOffset={trackLabelOffset}
            contentTop={rulerHeight}
            tracksHeight={rowTracks[i]!.tracksHeight}
            showGridlines={showGridlines}
            leftBuffer={exportMargin}
          />
        </g>
      ),
    }
    const level: LinearSyntenyViewHelperModel | undefined = levels[i]
    return level
      ? [
          viewRow,
          {
            key: `level-${i}`,
            height: level.height,
            node: (
              <SVGSyntenyLevel
                clipId={`synclip-${svgNodeId(model)}-${i}`}
                width={width}
                levelHeight={level.height}
                trackLabelOffset={trackLabelOffset}
                groundColor={level.groundColor}
                rendering={renderings[i]!}
                offscreenMates={
                  <SVGOffscreenMates
                    level={level}
                    width={width}
                    height={level.height}
                    groundColor={level.groundColor}
                    opts={opts}
                  />
                }
                // one legend for the whole view, in the topmost ribbon band —
                // the same placement the on-screen LevelSection uses
                legend={
                  i === 0 && model.showColorLegend ? (
                    <SVGColorByLegend
                      colorBy={model.uniformColorBy}
                      trackChips={model.colorLegendChips}
                      viewWidth={width}
                      maxHeight={level.height}
                      alpha={model.alpha}
                      cigarOps={model.presentCigarKinds}
                      attributeRanges={model.attributeRanges}
                    />
                  ) : undefined
                }
              />
            ),
          },
        ]
      : [viewRow]
  })

  // stack the rows top to bottom: one running top offset positions each group
  // and ends as the total content height, so the canvas size and the layout
  // share one source of truth.
  let y = 0
  const children = rows.map(row => {
    const top = y
    y += row.height
    return (
      <g key={row.key} transform={`translate(0 ${top})`}>
        {row.node}
      </g>
    )
  })

  return wrapSvgExport({
    theme,
    width: w,
    height: y + exportMargin,
    fontFamily,
    Wrapper,
    children,
  })
}
