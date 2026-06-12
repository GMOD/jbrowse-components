import type React from 'react'

import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { YScaleBar } from '@jbrowse/wiggle-core'
import { when } from 'mobx'

import PileupBezierArcsSvg from './components/PileupBezierArcsSvg.tsx'
import SashimiArcsSvg from './components/SashimiArcsSvg.tsx'
import TlenAxisLabel from './components/TlenAxisLabel.tsx'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { drawAlignmentLabels } from './components/drawAlignmentLabels.ts'
import { drawAlignmentsToCtx } from './renderers/Canvas2DAlignmentsRenderer.ts'
import { buildSectionRenders } from './sectionLayout.ts'
import { getMismatchContrastMap } from '../shared/util.ts'

import type { LinearAlignmentsDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export async function renderSvg(
  model: LinearAlignmentsDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const theme = createJBrowseTheme(opts?.theme)
  const view = getContainingView(model) as LinearGenomeViewModel
  await when(
    () => model.rpcDataMap.size > 0 || !!model.error || model.regionTooLarge,
  )

  if (model.error) {
    return (
      <SVGErrorBox
        error={model.error}
        width={view.width}
        height={model.height}
      />
    )
  }

  const baseState = model.renderState
  if (!baseState || model.laidOutPileupMap.size === 0) {
    return null
  }

  const totalWidth = view.totalWidthPx
  const displayHeight = model.height
  const renderBlocks = buildRenderBlocks(view.visibleRegions)

  // SVG export renders the full display from y=0 with no Y scroll. Reuse the
  // model's renderState — only viewport-related fields are overridden. The
  // section geometry is rebuilt at scrollTop 0 so grouped coverage bands aren't
  // shifted off-screen (no-op for the ungrouped single-section case).
  const state = {
    ...baseState,
    scrollTop: 0,
    canvasWidth: totalWidth,
    canvasHeight: displayHeight,
    sections: buildSectionRenders(model.sections, {
      scrollTop: 0,
      canvasHeight: displayHeight,
    }),
  }

  // Same compute as the on-screen getter; only scrollTop differs (SVG export
  // shows the full track height regardless of Y scroll).
  const labels = computeVisibleLabels({
    view,
    sections: model.renderSections,
    height: displayHeight,
    featureHeight: model.featureHeight,
    featureSpacing: model.featureSpacing,
    showMismatches: model.showMismatches,
    scrollTop: 0,
  })
  const contrastMap = getMismatchContrastMap(
    model.colorBy.type,
    model.showModifications,
    theme,
  )
  const pileupNode = paintLayer(totalWidth, displayHeight, opts, ctx => {
    drawAlignmentsToCtx(
      ctx,
      {
        sections: model.sourceSections,
        arcsRpcDataMap: model.arcsRpcDataMap,
      },
      renderBlocks,
      state,
    )
    drawAlignmentLabels(ctx, labels, contrastMap, theme)
  })

  // Sashimi and linked-read bezier arcs stay vector SVG by design (low arc
  // count + native hover in the on-screen overlay); these export components
  // share their geometry helpers with the overlays so the paths can't drift.
  return (
    <>
      <SvgClipRect
        id={`alignments-clip-${model.id}`}
        width={view.width}
        height={displayHeight}
      >
        {pileupNode}
        <SashimiArcsSvg model={model} view={view} />
        <PileupBezierArcsSvg model={model} view={view} />
      </SvgClipRect>
      {model.showCoverage && model.coverageTicks ? (
        // anchors scale bars to left edge of content; non-zero only when
        // scrolled before genome start
        <g transform={`translate(${Math.max(-view.offsetPx, 0)})`}>
          <YScaleBar ticks={model.coverageTicks} orientation="left" />
        </g>
      ) : null}
      {model.insertSizeTicks ? (
        // 50 matches the on-screen SVG width for the insert-size scale bar.
        // Down mode puts the TLEN scalebar on the left (matches PileupComponent).
        model.readConnectionsDown ? (
          <g transform="translate(45)">
            <YScaleBar ticks={model.insertSizeTicks} orientation="left" />
            <TlenAxisLabel
              yTop={model.insertSizeTicks.yTop}
              yBottom={model.insertSizeTicks.yBottom}
              x={6}
            />
          </g>
        ) : (
          <g transform={`translate(${totalWidth - 50})`}>
            <YScaleBar ticks={model.insertSizeTicks} orientation="right" />
            <TlenAxisLabel
              yTop={model.insertSizeTicks.yTop}
              yBottom={model.insertSizeTicks.yBottom}
            />
          </g>
        )
      ) : null}
    </>
  )
}
