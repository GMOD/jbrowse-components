import type React from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView, measureText } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SVGErrorBox,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { YScaleBar } from '@jbrowse/wiggle-core'

import PileupBezierArcsSvg from './components/PileupBezierArcsSvg.tsx'
import SashimiArcsSvg from './components/SashimiArcsSvg.tsx'
import TlenAxisLabel from './components/TlenAxisLabel.tsx'
import { buildColorPaletteFromTheme } from './components/alignmentComponentUtils.ts'
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
import type { Theme } from '@mui/material'

// Static equivalent of the on-screen GroupLabelsOverlay chip (no
// collapse/expand affordances — those are interactive-only). A background box
// behind the text, not bare text, so the label stays legible over a busy
// pileup/coverage background.
function GroupLabelBox({
  x,
  y,
  text,
  theme,
}: {
  x: number
  y: number
  text: string
  theme: Theme
}) {
  const fontSize = 11
  const paddingX = 4
  const height = 16
  const width = measureText(text, fontSize) + paddingX * 2
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={3}
        fill={theme.palette.background.paper}
        fillOpacity={0.85}
      />
      <text
        x={x + paddingX}
        y={y + height - 4}
        fontSize={fontSize}
        fill={theme.palette.text.secondary}
      >
        {text}
      </text>
    </g>
  )
}

export async function renderSvg(
  model: LinearAlignmentsDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const theme = createJBrowseTheme(opts?.theme)
  const view = getContainingView(model) as LinearGenomeViewModel
  // svgReady waits for ALL visible regions, not just the first to stream in, so
  // whole-genome / multi-region exports aren't partially drawn.
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

  const baseState = model.renderState
  if (
    !baseState ||
    model.sourceSections.every(s => s.laidOutPileupMap.size === 0)
  ) {
    return null
  }

  // canvas spans the viewport (visibleRegions coords are viewport-relative and
  // clipped to view.width below), matching the on-screen canvas rather than the
  // full-genome totalWidthPx
  const canvasWidth = view.width
  const displayHeight = model.height
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const { coverageTicks } = model

  // SVG export renders the full display from y=0 with no Y scroll. Reuse the
  // model's renderState — only viewport-related fields are overridden. The
  // section geometry is rebuilt at scrollTop 0 so grouped coverage bands aren't
  // shifted off-screen (no-op for the ungrouped single-section case).
  const state = {
    ...baseState,
    scrollTop: 0,
    canvasWidth,
    canvasHeight: displayHeight,
    // Export colors follow the export theme (opts.theme), not the live session
    // theme, so the pileup matches the labels/contrast which already use it.
    colors: buildColorPaletteFromTheme(theme),
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
  const contrastMap = getMismatchContrastMap(model.showModifications, theme)
  const pileupNode = paintLayer(canvasWidth, displayHeight, opts, ctx => {
    drawAlignmentsToCtx(
      ctx,
      {
        sections: model.sourceSections,
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
      {model.showCoverage && coverageTicks
        ? // anchors scale bars to left edge of content; non-zero x only when
          // scrolled before genome start. One bar per section's coverage band
          // (export is always at scrollTop 0, so `coverageTop` is the
          // section's final y) — mirrors the on-screen `CoverageAxisHost`.
          model.renderSections.map(section => (
            <g
              key={section.groupKey || 'ungrouped'}
              transform={`translate(${Math.max(-view.offsetPx, 0)}, ${section.coverageTop})`}
            >
              <YScaleBar ticks={coverageTicks} orientation="left" />
            </g>
          ))
        : null}
      {model.insertSizeTicks ? (
        // 50 matches the on-screen SVG width for the insert-size scale bar.
        // Down mode puts the TLEN scalebar on the left (matches PileupComponent).
        model.readConnectionsDown ? (
          <g transform="translate(45)">
            <YScaleBar ticks={model.insertSizeTicks} orientation="left" />
            <TlenAxisLabel
              yTop={model.insertSizeTicks.yTop}
              yBottom={model.insertSizeTicks.yBottom}
              x={11}
            />
          </g>
        ) : (
          <g transform={`translate(${canvasWidth - 50})`}>
            <YScaleBar ticks={model.insertSizeTicks} orientation="right" />
            <TlenAxisLabel
              yTop={model.insertSizeTicks.yTop}
              yBottom={model.insertSizeTicks.yBottom}
            />
          </g>
        )
      ) : null}
      {model.isGrouped
        ? // Rendered last (highest z-order) so a group's label box always sits
          // on top of the pileup/coverage/arcs it's labeling.
          model.renderSections.map(section => (
            <GroupLabelBox
              key={section.groupKey || 'ungrouped'}
              x={Math.max(-view.offsetPx, 0) + 4}
              y={section.coverageTop + 1}
              text={section.label || 'ungrouped'}
              theme={theme}
            />
          ))
        : null}
    </>
  )
}
