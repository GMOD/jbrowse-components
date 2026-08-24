/* eslint-disable react-refresh/only-export-components */
import React from 'react'

import { svgNodeId } from '@jbrowse/core/svg/svgId'
import {
  SvgColorLegend,
  createJBrowseTheme,
  legendEntries,
} from '@jbrowse/core/ui'
import { resolvePalette, colorLongreadInv } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import { getMafCoverageColors } from '../LinearMafRenderer/coverageBandColors.ts'
import { drawMafBlocks } from '../LinearMafRenderer/drawMafBlocks.ts'
import { drawMafCoverage } from '../LinearMafRenderer/drawMafCoverage.ts'
import { drawMafAnnotations } from '../LinearMafRenderer/rendering/annotations.ts'
import { drawMafCodons } from '../LinearMafRenderer/rendering/codons.ts'
import { drawMafDeletionLabels } from '../LinearMafRenderer/rendering/deletions.ts'
import { drawMafEmptyLines } from '../LinearMafRenderer/rendering/emptyLines.ts'
import { drawMafInsertions } from '../LinearMafRenderer/rendering/insertions.ts'
import { drawInversions } from '../LinearMafRenderer/rendering/inversions.ts'
import { drawMafLabels } from '../LinearMafRenderer/rendering/labels.ts'
import { drawMafSummaryBars } from '../LinearMafRenderer/rendering/summaryBars.ts'
import {
  getCodonColors,
  getContrastBaseMap,
  getFrameColors,
  getMafColorPalette,
} from '../LinearMafRenderer/util.ts'
import { SvgBandLabels } from './components/MafBandLabels.tsx'
import { SvgYScaleGutter } from './components/MafYScaleGutter.tsx'
import {
  conservationTicks,
  drawCodonConservation,
  drawConservation,
} from './components/drawConservation.ts'
import { drawMafRowsCanvas2d } from './components/drawMafRowsCanvas2d.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

export async function renderSvg(
  model: LinearMafDisplayModel,
  opts: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  // renderDisplaySvg's awaitSvgReady waits for every visible region to load (not
  // just sources to resolve) and goes false during an in-place refetch, so
  // exports never capture a partial or stale viewport.
  return renderDisplaySvg(model, opts, MafSvgBody)
}

function MafSvgBody({
  model,
  view,
  height,
  canvasWidth: width,
  renderBlocks,
  opts,
}: LgvSvgBodyProps<LinearMafDisplayModel>) {
  const state = model.renderState
  const theme = createJBrowseTheme(opts?.theme)
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
    coverageDisplayHeight,
    rowsTopOffset,
    coverageTicks,
    coverageBandActive,
    coverageDomain,
    conservationBandActive,
    codonConservationActive,
    conservationHeight,
    rowsCanvas2dMode,
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

  return (
    <SvgClipRect
      id={`maf-clip-${svgNodeId(model)}`}
      width={view.width}
      height={height}
    >
      {coverageBandActive ? (
        <PaintLayer
          width={width}
          height={model.coverageHeight}
          opts={opts}
          paint={ctx => {
            drawMafCoverage(ctx, renderBlocks, model.rpcDataMap, {
              coverageHeight: model.coverageHeight,
              canvasWidth: width,
              domainMax: coverageDomain?.[1] ?? 0,
              // The export-chosen palette, not the live one — the band's colours
              // come through the render state on screen and have to follow the
              // same theme here as the cells under them.
              colors: getMafCoverageColors(palette),
            })
          }}
        />
      ) : null}
      {conservationBandActive ? (
        <g transform={`translate(0, ${coverageDisplayHeight})`}>
          <PaintLayer
            width={width}
            height={conservationHeight}
            opts={opts}
            paint={ctx => {
              // Same gate as the on-screen band: the codon band only replaces
              // the per-base one where frames actually define codons.
              if (codonConservationActive) {
                drawCodonConservation(ctx, model.visibleCodonConservation, {
                  conservationHeight,
                  canvasWidth: width,
                  theme,
                })
              } else {
                drawConservation(ctx, renderBlocks, model.rpcDataMap, {
                  conservationHeight,
                  canvasWidth: width,
                  theme,
                })
              }
            }}
          />
        </g>
      ) : null}
      <g transform={`translate(0, ${rowsTopOffset})`}>
        <PaintLayer
          width={width}
          height={rowsHeight}
          opts={opts}
          paint={ctx => {
            // One rows rendering at a time, and which one is the model's
            // decision — `rowsCanvas2dMode` is what MafRowsCanvas paints from,
            // through the same `drawMafRowsCanvas2d`, so the export can't
            // disagree with the screen. Codon cells are drawn by drawMafCodons
            // below, so that mode paints nothing here.
            if (rowsCanvas2dMode !== undefined) {
              drawMafRowsCanvas2d(ctx, model, renderBlocks, width)
            } else if (basesRenderingActive) {
              drawMafBlocks(ctx, model.rpcDataMap, renderBlocks, svgState)
            }
            drawMafEmptyLines(ctx, model.visibleEmptyLines, svgState.palette)
            drawMafSummaryBars(ctx, model.visibleSummaryBars, svgState.palette)
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
            drawMafDeletionLabels(ctx, model.visibleDeletions, svgState.palette)
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
        <SvgTreeSidebar
          showTree={showTree}
          hierarchy={hierarchy}
          sources={sources}
          rowHeight={effectiveRowHeight}
          treeAreaWidth={treeAreaWidth}
          showLabels={showRowLabels && !!sources.length}
          scrollTop={scrollTop}
          availableHeight={rowsHeight}
        />
      </g>
      {/* The same titles the display shows on screen (`MafBandLabels`), and for
          the same reason: with both bands drawn they are told apart only by
          their Y-axis units, and an exported figure can't be hovered. */}
      <SvgBandLabels labels={model.bandLabels} theme={theme} />
      {coverageBandActive && coverageTicks ? (
        <SvgYScaleGutter y={0} ticks={coverageTicks} />
      ) : null}
      {conservationBandActive ? (
        <SvgYScaleGutter
          y={coverageDisplayHeight}
          ticks={conservationTicks(conservationHeight)}
        />
      ) : null}
      {/* The same color key the display shows on screen (`MafLegends`).
          Without it an exported codon or source-chromosome figure has colored
          cells and nothing saying what the colors mean — and there the
          swatches are the only decoder. No `onDismiss`: an exported legend
          can't be clicked. */}
      <SvgColorLegend
        entries={legendEntries({ items: model.legendItems })}
        canvasWidth={width}
        maxHeight={height}
        testid="maf-color-legend"
      />
    </SvgClipRect>
  )
}
