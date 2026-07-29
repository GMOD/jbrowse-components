/* eslint-disable react-refresh/only-export-components */
import React from 'react'

import {
  SvgColorLegend,
  createJBrowseTheme,
  legendEntries,
} from '@jbrowse/core/ui'
import { colorLongreadInv } from '@jbrowse/core/ui/theme'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgClipRect,
  renderDisplaySvg,
} from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import { drawMafBlocks } from '../LinearMafRenderer/drawMafBlocks.ts'
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
import { SvgYScaleGutter } from './components/MafYScaleGutter.tsx'
import {
  conservationTicks,
  drawCodonConservation,
  drawConservation,
} from './components/drawConservation.ts'
import { drawMafCoverage } from './components/drawMafCoverage.ts'
import { drawRowIdentity } from './components/drawRowIdentity.ts'
import { drawSourceChrom } from './components/drawSourceChrom.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'
import type {
  ExportSvgDisplayOptions,
  LgvSvgBodyProps,
} from '@jbrowse/plugin-linear-genome-view'

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
  opts,
}: LgvSvgBodyProps<LinearMafDisplayModel>) {
  const state = model.renderState
  const theme = createJBrowseTheme(opts?.theme)
  const {
    hierarchy,
    showTree,
    treeAreaWidth,
    sources,
    effectiveRowHeight,
    rowsHeight,
    coverageDisplayHeight,
    rowsTopOffset,
    coverageTicks,
    showCoverage,
    coverageDomain,
    showConservation,
    conservationMode,
    conservationHeight,
    activeRowRendering,
    rowProportion,
  } = model
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  // SVG export builds its palette from the user-selected export theme, not
  // the live on-screen palette, so light/dark export choices stay consistent.
  const svgState = {
    ...state,
    canvasWidth: width,
    canvasHeight: rowsHeight,
    palette: getMafColorPalette(theme),
  }
  const contrast = getContrastBaseMap(theme)

  return (
    <SvgClipRect id={`maf-clip-${model.id}`} width={view.width} height={height}>
      {showCoverage ? (
        <PaintLayer
          width={width}
          height={model.coverageHeight}
          opts={opts}
          paint={ctx => {
            drawMafCoverage(ctx, renderBlocks, model.rpcDataMap, {
              coverageHeight: model.coverageHeight,
              canvasWidth: width,
              domainMax: coverageDomain?.[1] ?? 0,
              theme,
            })
          }}
        />
      ) : null}
      {showConservation ? (
        <g transform={`translate(0, ${coverageDisplayHeight})`}>
          <PaintLayer
            width={width}
            height={conservationHeight}
            opts={opts}
            paint={ctx => {
              if (conservationMode === 'codon') {
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
            // One rows rendering at a time (see activeRowRendering): the codon
            // view and the per-row identity plot each replace the base SNP
            // rendering; codon cells are drawn by drawMafCodons below.
            if (activeRowRendering === 'codon') {
              // codon cells drawn below; no base/identity rendering
            } else if (activeRowRendering === 'sourceChrom') {
              if (sources?.length) {
                drawSourceChrom(ctx, renderBlocks, model.rpcDataMap, {
                  rowHeight: effectiveRowHeight,
                  rowProportion,
                  nRows: sources.length,
                  canvasWidth: width,
                  ranks: model.sourceChromRanks.ranks,
                })
              }
            } else if (activeRowRendering !== 'bases') {
              if (sources?.length) {
                drawRowIdentity(ctx, renderBlocks, model.rpcDataMap, {
                  rowHeight: effectiveRowHeight,
                  rowProportion,
                  nRows: sources.length,
                  canvasWidth: width,
                  mode: activeRowRendering,
                })
              }
            } else {
              drawMafBlocks(ctx, model.rpcDataMap, renderBlocks, svgState)
            }
            drawMafEmptyLines(ctx, model.visibleEmptyLines, svgState.palette)
            drawMafSummaryBars(ctx, model.visibleSummaryBars, svgState.palette)
            drawMafAnnotations(ctx, model.visibleFrames, getFrameColors(theme))
            // Insertion markers + deletion count labels render from the same
            // positioned markers the on-screen overlays use, so export matches
            // the screen. Insertions are base-level only (gated like the live
            // InsertionsOverlay); deletion labels draw in every mode.
            if (activeRowRendering === 'bases') {
              drawMafInsertions(
                ctx,
                model.visibleInsertions,
                svgState.palette.insertionColor,
                1 / view.bpPerPx,
              )
            }
            drawMafDeletionLabels(ctx, model.visibleDeletions)
            drawMafLabels(
              ctx,
              model.visibleLabels,
              contrast,
              state.mismatchRendering,
            )
            drawMafCodons(ctx, model.visibleCodons, getCodonColors(theme))
            drawInversions(ctx, model.visibleInversions, colorLongreadInv)
          }}
        />
        <SvgTreeSidebar
          showTree={showTree}
          hierarchy={hierarchy}
          sources={sources ?? []}
          rowHeight={effectiveRowHeight}
          treeAreaWidth={treeAreaWidth}
          showLabels={!!sources?.length}
        />
      </g>
      {showCoverage && coverageTicks ? (
        <SvgYScaleGutter y={0} ticks={coverageTicks} />
      ) : null}
      {showConservation ? (
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
