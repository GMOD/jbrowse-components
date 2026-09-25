/* eslint-disable react-refresh/only-export-components */
import React from 'react'

import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { resolvePalette, colorLongreadInv } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import { mafCoverageBandColors } from '../LinearMafRenderer/coverageBandColors.ts'
import {
  MAF_COVERAGE_MARKS,
  MAF_ROWS_MARKS,
  MAF_ROW_MARK,
  MAF_SOURCE_CHROM_MARK,
} from '../LinearMafRenderer/mafMarks.ts'
import { drawMafAnnotations } from '../LinearMafRenderer/rendering/annotations.ts'
import { drawMafCodons } from '../LinearMafRenderer/rendering/codons.ts'
import { drawMafDeletionLabels } from '../LinearMafRenderer/rendering/deletions.ts'
import { drawMafEmptyLines } from '../LinearMafRenderer/rendering/emptyLines.ts'
import { drawMafInsertions } from '../LinearMafRenderer/rendering/insertions.ts'
import { drawInversions } from '../LinearMafRenderer/rendering/inversions.ts'
import { drawMafLabels } from '../LinearMafRenderer/rendering/labels.ts'
import {
  getCodonColors,
  getContrastBaseMap,
  getFrameColors,
  getMafColorPalette,
} from '../LinearMafRenderer/util.ts'
import { SvgBandLabels } from './components/MafBandLabels.tsx'
import {
  drawCodonConservation,
  drawConservation,
} from './components/drawConservation.ts'
import { drawMafRowsCanvas2d } from './components/drawMafRowsCanvas2d.ts'
import { visibleRowRange } from './components/visibleRegionGeometry.ts'
import { cullMafRows, encodeMafRows } from './encodeMafRows.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

export async function renderSvg(
  model: LinearMafDisplayModel,
  opts: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, MafSvgBody)
}

function MafSvgBody({
  model,
  view,
  canvasWidth: width,
  renderBlocks,
  overlays,
  opts,
}: LgvSvgBodyProps<LinearMafDisplayModel>) {
  const state = model.renderState
  // SVG export colors follow the export-chosen theme, not the live session one
  const palette = resolvePalette({ configTheme: opts?.theme })
  const {
    hierarchy,
    showTree,
    showRowLabels,
    treeAreaWidth,
    sources,
    effectiveRowHeight,
    rowsHeight,
    topBands,
    rowsTopOffset,
    coverageBandActive,
    conservationBandActive,
    codonConservationActive,
    conservationDisplayHeight,
    basesRenderingActive,
    scrollTop,
  } = model
  // SVG export builds its palette from the user-selected export theme, not
  // the live on-screen palette, so light/dark export choices stay consistent.
  // The export draws each band into its own `PaintLayer`, translated to that
  // band's own origin — so the rows painter gets a rows-sized canvas at offset
  // 0, not the display's stacked one.
  const svgState = {
    ...state,
    canvasWidth: width,
    canvasHeight: rowsHeight,
    rowsTop: 0,
    rowsHeight,
    palette: getMafColorPalette(palette),
  }
  const contrast = getContrastBaseMap(palette)
  // Re-encoded here rather than read off `encodedUpload`: the export theme is a
  // different palette, so the screen's channels carry the wrong colours.
  const encodeProps = model.rowsEncodeProps()
  const shownRows = visibleRowRange(effectiveRowHeight, scrollTop, rowsHeight)
  const svgRows = new Map(
    [...model.rowsSources].map(([idx, source]) => [
      idx,
      cullMafRows(
        encodeMafRows(source, {
          ...encodeProps,
          gpu: { ...encodeProps.gpu, palette: svgState.palette },
        }),
        renderBlocks.filter(b => b.displayedRegionIndex === idx),
        width,
        shownRows,
      ),
    ]),
  )
  // The summary bars were an overlay before they were a mark, and a
  // `plotOnly` export still leaves them out.
  const rowMarks = overlays
    ? MAF_ROWS_MARKS
    : [MAF_ROW_MARK, MAF_SOURCE_CHROM_MARK]

  return (
    <>
      {coverageBandActive ? (
        <PaintLayer
          width={width}
          height={topBands.reserved.coverage}
          opts={opts}
          paint={ctx => {
            paintMarkBlocks(
              ctx,
              MAF_COVERAGE_MARKS,
              model.rpcDataMap,
              renderBlocks,
              {
                ...svgState,
                canvasHeight: topBands.reserved.coverage,
                coverage: {
                  ...model.coverageBandState,
                  height: topBands.reserved.coverage,
                  // The export-chosen palette, not the live one — the band's
                  // colours follow the same theme as the cells under them.
                  colors: mafCoverageBandColors(palette),
                },
              },
            )
          }}
        />
      ) : null}
      {conservationBandActive ? (
        <g transform={`translate(0, ${topBands.top.conservation})`}>
          <PaintLayer
            width={width}
            height={conservationDisplayHeight}
            opts={opts}
            paint={ctx => {
              // Same gate as the on-screen band: the codon band only replaces
              // the per-base one where frames actually define codons.
              if (codonConservationActive) {
                drawCodonConservation(ctx, model.visibleCodonConservation, {
                  conservationHeight: conservationDisplayHeight,
                  canvasWidth: width,
                  palette,
                })
              } else {
                drawConservation(ctx, renderBlocks, model.rpcDataMap, {
                  conservationHeight: conservationDisplayHeight,
                  canvasWidth: width,
                  palette,
                })
              }
            }}
          />
        </g>
      ) : null}
      <g transform={`translate(0, ${rowsTopOffset})`}>
        {/* The row painters cull by row, not by pixel, so the partly scrolled
            top row starts above the box; on screen its canvas clips it, and a
            vector layer has no canvas edge to do that. */}
        <SvgClipRect
          id={`maf-rows-${svgNodeId(model)}`}
          width={width}
          height={rowsHeight}
        >
          <PaintLayer
            width={width}
            height={rowsHeight}
            opts={opts}
            paint={ctx => {
              // The screen's stacking: the backend's row marks, then the
              // identity plot's canvas over them. Only the model's active
              // rendering encodes or paints anything.
              paintMarkBlocks(ctx, rowMarks, svgRows, renderBlocks, svgState)
              drawMafRowsCanvas2d(ctx, model, renderBlocks, width)
              // the overlay canvases the screen stacks over the rows canvas
              if (!overlays) {
                return
              }
              drawMafEmptyLines(ctx, model.visibleEmptyLines, svgState.palette)
              drawMafAnnotations(
                ctx,
                model.visibleFrames,
                getFrameColors(palette),
              )
              // Insertion markers + deletion count labels render from the same
              // positioned markers the on-screen overlays use, so export matches
              // the screen. Insertions are base-level only (gated like the live
              // InsertionsOverlay); deletion labels draw in every mode.
              if (basesRenderingActive) {
                drawMafInsertions(
                  ctx,
                  model.visibleInsertions,
                  svgState.palette.insertionColor,
                  1 / view.bpPerPx,
                )
              }
              // `svgState.palette`, so the count follows the export theme the
              // gap cells under it were painted from
              drawMafDeletionLabels(
                ctx,
                model.visibleDeletions,
                svgState.palette,
              )
              drawMafLabels(
                ctx,
                model.visibleLabels,
                contrast,
                state.mismatchRendering,
              )
              drawMafCodons(ctx, model.visibleCodons, getCodonColors(palette))
              drawInversions(ctx, model.visibleInversions, colorLongreadInv)
            }}
          />
        </SvgClipRect>
        {overlays ? (
          <SvgTreeSidebar
            showTree={showTree}
            hierarchy={hierarchy}
            sources={sources}
            rowHeight={effectiveRowHeight}
            treeAreaWidth={treeAreaWidth}
            showLabels={showRowLabels}
            scrollTop={scrollTop}
            availableHeight={rowsHeight}
            clusterProvenance={model.rowTreeProvenance}
            contentBlocks={view.dynamicBlocks.contentBlocks}
          />
        ) : null}
      </g>
      {/* The same titles the display shows on screen (`MafBandLabels`), and for
        the same reason: with both bands drawn they are told apart only by
        their Y-axis units, and an exported figure can't be hovered. */}
      {overlays ? (
        <SvgBandLabels labels={model.bandLabels} palette={palette} />
      ) : null}
    </>
  )
}
