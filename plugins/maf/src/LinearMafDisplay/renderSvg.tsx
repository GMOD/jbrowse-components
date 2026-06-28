/* eslint-disable react-refresh/only-export-components */
import React from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgChrome,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { SvgRowLabels, SvgTreePath } from '@jbrowse/tree-sidebar'
import { YScaleBar } from '@jbrowse/wiggle-core'

import {
  conservationTicks,
  drawConservation,
} from './components/drawConservation.ts'
import { drawMafCoverage } from './components/drawMafCoverage.ts'
import { drawRowIdentity } from './components/drawRowIdentity.ts'
import { YSCALE_AXIS_X } from './components/yScaleAxis.ts'
import { drawMafBlocks } from '../LinearMafRenderer/drawMafBlocks.ts'
import { drawMafAnnotations } from '../LinearMafRenderer/rendering/annotations.ts'
import { drawMafCodons } from '../LinearMafRenderer/rendering/codons.ts'
import { drawMafEmptyLines } from '../LinearMafRenderer/rendering/emptyLines.ts'
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
    <SvgChrome error={model.error} width={view.width} height={height}>
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
  const state = model.renderState
  if (!state) {
    return null
  }

  const theme = createJBrowseTheme(opts.theme)
  const width = view.totalWidthPx
  const {
    hierarchy,
    showTree,
    treeAreaWidth,
    sources,
    rowHeight,
    rowsHeight,
    coverageDisplayHeight,
    rowsTopOffset,
    coverageTicks,
    showCoverage,
    coverageDomain,
    showConservation,
    conservationHeight,
    activeRowRendering,
    rowProportion,
  } = model
  const treeShowing = showTree && !!hierarchy
  const labelOffset = treeShowing ? treeAreaWidth : 0
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
      {showCoverage
        ? paintLayer(width, model.coverageHeight, opts, ctx => {
            drawMafCoverage(ctx, renderBlocks, model.rpcDataMap, {
              coverageHeight: model.coverageHeight,
              canvasWidth: width,
              domainMax: coverageDomain?.[1] ?? 0,
              theme,
            })
          })
        : null}
      {showConservation ? (
        <g transform={`translate(0, ${coverageDisplayHeight})`}>
          {paintLayer(width, conservationHeight, opts, ctx => {
            drawConservation(ctx, renderBlocks, model.rpcDataMap, {
              conservationHeight,
              canvasWidth: width,
              theme,
            })
          })}
        </g>
      ) : null}
      <g transform={`translate(0, ${rowsTopOffset})`}>
        {paintLayer(width, rowsHeight, opts, ctx => {
          // Either/or, like UCSC wigMaf: the per-row identity plot replaces the
          // base SNP rendering when zoomed out past base level.
          if (activeRowRendering !== 'bases' && sources?.length) {
            drawRowIdentity(ctx, renderBlocks, model.rpcDataMap, {
              rowHeight,
              rowProportion,
              nRows: sources.length,
              canvasWidth: width,
              mode: activeRowRendering,
            })
          } else {
            drawMafBlocks(ctx, model.rpcDataMap, renderBlocks, svgState)
          }
          drawMafEmptyLines(ctx, model.visibleEmptyLines, svgState.palette)
          drawMafSummaryBars(ctx, model.visibleSummaryBars, svgState.palette)
          drawMafAnnotations(ctx, model.visibleFrames, getFrameColors(theme))
          drawMafLabels(
            ctx,
            model.visibleLabels,
            contrast,
            state.mismatchRendering,
          )
          drawMafCodons(ctx, model.visibleCodons, getCodonColors(theme))
        })}
        {treeShowing ? <SvgTreePath hierarchy={hierarchy} /> : null}
        {sources?.length ? (
          <SvgRowLabels
            sources={sources}
            rowHeight={rowHeight}
            labelOffset={labelOffset}
          />
        ) : null}
      </g>
      {showCoverage && coverageTicks ? (
        <g transform={`translate(${YSCALE_AXIS_X}, 0)`}>
          <YScaleBar ticks={coverageTicks} orientation="left" />
        </g>
      ) : null}
      {showConservation ? (
        <g transform={`translate(${YSCALE_AXIS_X}, ${coverageDisplayHeight})`}>
          <YScaleBar
            ticks={conservationTicks(conservationHeight)}
            orientation="left"
          />
        </g>
      ) : null}
    </SvgClipRect>
  )
}
