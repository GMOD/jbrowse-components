/* eslint-disable react-refresh/only-export-components */
import React from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { colorLongreadInv } from '@jbrowse/core/ui/theme'
import { getContainingView } from '@jbrowse/core/util'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgChrome,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { SvgTreeSidebar } from '@jbrowse/tree-sidebar'
import { YScaleBar } from '@jbrowse/wiggle-core'

import {
  conservationTicks,
  drawCodonConservation,
  drawConservation,
} from './components/drawConservation.ts'
import { drawMafCoverage } from './components/drawMafCoverage.ts'
import { drawRowIdentity } from './components/drawRowIdentity.ts'
import { drawSourceChrom } from './components/drawSourceChrom.ts'
import { YSCALE_AXIS_X } from './components/yScaleAxis.ts'
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

import type { LinearMafDisplayModel } from './stateModel.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { YScaleTicks } from '@jbrowse/wiggle-core'

export async function renderSvg(
  model: LinearMafDisplayModel,
  opts: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  // svgReady waits for every visible region to load (not just sources to
  // resolve) and goes false during an in-place refetch, so exports never
  // capture a partial or stale viewport.
  await awaitSvgReady(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const height = opts.overrideHeight ?? model.height
  return (
    <SvgChrome
      error={model.error}
      regionTooLarge={model.regionTooLarge}
      width={view.width}
      height={height}
    >
      <MafSvgBody model={model} view={view} height={height} opts={opts} />
    </SvgChrome>
  )
}

function MafSvgBody({
  model,
  view,
  height,
  opts,
}: {
  model: LinearMafDisplayModel
  view: LinearGenomeViewModel
  height: number
  opts: ExportSvgDisplayOptions
}) {
  // svgReady requires loadedRegions.size > 0, and renderState is undefined only
  // pre-init / pre-load, so this narrows for TS only — unreachable in export
  // (the on-screen render autorun is where the real undefined branch lives).
  const state = model.renderState
  if (!state) {
    return null
  }

  const theme = createJBrowseTheme(opts.theme)
  // canvas spans the viewport (visibleRegions coords are viewport-relative and
  // clipped to view.width below), matching the on-screen canvas rather than the
  // full-genome totalWidthPx
  const width = view.width
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
        <LeftAxis y={0} ticks={coverageTicks} />
      ) : null}
      {showConservation ? (
        <LeftAxis
          y={coverageDisplayHeight}
          ticks={conservationTicks(conservationHeight)}
        />
      ) : null}
    </SvgClipRect>
  )
}

// A left-orientation y-axis in the shared axis gutter (YSCALE_AXIS_X), at a
// vertical band offset — coverage sits at y=0, conservation below it.
function LeftAxis({ y, ticks }: { y: number; ticks: YScaleTicks }) {
  return (
    <g transform={`translate(${YSCALE_AXIS_X}, ${y})`}>
      <YScaleBar ticks={ticks} orientation="left" />
    </g>
  )
}
