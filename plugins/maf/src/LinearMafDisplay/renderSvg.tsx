import React from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SVGErrorBox,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { SvgRowLabels, SvgTreePath } from '@jbrowse/tree-sidebar'
import { YScaleBar } from '@jbrowse/wiggle-core'

import { drawConservation } from './components/drawConservation.ts'
import { drawMafCoverage } from './components/drawMafCoverage.ts'
import {
  ROW_IDENTITY_HEATMAP_ALPHA,
  drawRowIdentityHeatmap,
} from './components/drawRowIdentity.ts'
import { drawMafBlocks } from '../LinearMafRenderer/drawMafBlocks.ts'
import { drawMafEmptyLines } from '../LinearMafRenderer/rendering/emptyLines.ts'
import { drawMafLabels } from '../LinearMafRenderer/rendering/labels.ts'
import { drawMafSummaryBars } from '../LinearMafRenderer/rendering/summaryBars.ts'
import {
  getContrastBaseMap,
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
  const view = getContainingView(model) as LinearGenomeViewModel
  // svgReady waits for every visible region to load (not just sources to
  // resolve) and goes false during an in-place refetch, so exports never
  // capture a partial or stale viewport.
  await awaitSvgReady(model)

  if (model.error) {
    return (
      <SVGErrorBox
        error={model.error}
        width={view.width}
        height={model.height}
      />
    )
  }

  const state = model.renderState
  if (!state) {
    return null
  }

  const theme = createJBrowseTheme(opts.theme)
  const width = view.totalWidthPx
  const height = model.height
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
    showRowIdentityHeatmap,
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
          drawMafBlocks(ctx, model.rpcDataMap, renderBlocks, svgState)
          if (showRowIdentityHeatmap && sources?.length) {
            drawRowIdentityHeatmap(ctx, renderBlocks, model.rpcDataMap, {
              rowHeight,
              rowProportion,
              nRows: sources.length,
              canvasWidth: width,
              alpha: ROW_IDENTITY_HEATMAP_ALPHA,
            })
          }
          drawMafEmptyLines(ctx, model.visibleEmptyLines, svgState.palette)
          drawMafSummaryBars(ctx, model.visibleSummaryBars, svgState.palette)
          drawMafLabels(
            ctx,
            model.visibleLabels,
            contrast,
            state.mismatchRendering,
          )
        })}
        {treeShowing ? <SvgTreePath hierarchy={hierarchy} /> : null}
        {sources?.length ? (
          <SvgRowLabels
            sources={sources}
            rowHeight={rowHeight}
            labelOffset={labelOffset}
            details={model.rowIdentityLabels}
          />
        ) : null}
      </g>
      {showCoverage && coverageTicks ? (
        <g transform="translate(45, 0)">
          <YScaleBar ticks={coverageTicks} orientation="left" />
        </g>
      ) : null}
      {showConservation ? (
        <g transform={`translate(45, ${coverageDisplayHeight})`}>
          <YScaleBar
            ticks={{
              yTop: 0,
              yBottom: conservationHeight,
              items: [
                { value: 100, y: 0, label: '100%' },
                { value: 50, y: conservationHeight / 2, label: '50%' },
                { value: 0, y: conservationHeight, label: '0%' },
              ],
            }}
            orientation="left"
          />
        </g>
      ) : null}
    </SvgClipRect>
  )
}
