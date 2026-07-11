/* eslint-disable react-refresh/only-export-components */
import type React from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgChrome,
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
import { sectionKey } from './components/sectionScreen.ts'
import { groupSectionLabel } from './groupLabelStyle.ts'
import { drawAlignmentsToCtx } from './renderers/Canvas2DAlignmentsRenderer.ts'
import { buildSectionRenders } from './sectionLayout.ts'
import GroupLabelBox from './svgcomponents/GroupLabelBox.tsx'
import { getMismatchContrastMap } from '../shared/util.ts'

import type { LinearAlignmentsDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { Theme } from '@mui/material'

type RenderSection = LinearAlignmentsDisplayModel['renderSections'][number]

export async function renderSvg(
  model: LinearAlignmentsDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  // svgReady waits for ALL visible regions, not just the first to stream in, so
  // whole-genome / multi-region exports aren't partially drawn.
  await awaitSvgReady(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const height = opts?.overrideHeight ?? model.height
  return (
    <SvgChrome
      error={model.error}
      regionTooLarge={model.regionTooLarge}
      width={view.width}
      height={height}
    >
      <AlignmentsSvgBody
        model={model}
        view={view}
        height={height}
        opts={opts}
      />
    </SvgChrome>
  )
}

// An empty (zero-read) region draws an empty pileup + coverage axis here, so
// this body renders unconditionally — there's no data-size gate. Readiness and
// the error terminal are already handled upstream (awaitSvgReady / SvgChrome).
function AlignmentsSvgBody({
  model,
  view,
  height,
  opts,
}: {
  model: LinearAlignmentsDisplayModel
  view: LinearGenomeViewModel
  height: number
  opts?: ExportSvgDisplayOptions
}) {
  const theme = createJBrowseTheme(opts?.theme)
  const baseState = model.renderState
  // canvas spans the viewport (visibleRegions coords are viewport-relative and
  // clipped to view.width below), matching the on-screen canvas rather than the
  // full-genome totalWidthPx
  const canvasWidth = view.width
  const displayHeight = height
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const { coverageTicks, insertSizeTicks, renderSections } = model
  // anchors the left-edge scale bars / group labels to the content; non-zero
  // only when scrolled before the genome start
  const contentLeft = Math.max(-view.offsetPx, 0)

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
    sections: renderSections,
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
      {model.showCoverage && coverageTicks ? (
        <CoverageScaleBars
          sections={renderSections}
          ticks={coverageTicks}
          left={contentLeft}
        />
      ) : null}
      {insertSizeTicks ? (
        <InsertSizeScaleBar
          ticks={insertSizeTicks}
          down={model.readConnectionsDown}
          canvasWidth={canvasWidth}
        />
      ) : null}
      {model.isGrouped ? (
        <GroupLabelBoxes
          sections={renderSections}
          left={contentLeft}
          theme={theme}
        />
      ) : null}
    </>
  )
}

// One left-orientation coverage y-axis per stacked section's coverage band.
// Export is always at scrollTop 0, so each `coverageTop` is the section's final
// y — mirrors the on-screen `CoverageAxisHost`.
function CoverageScaleBars({
  sections,
  ticks,
  left,
}: {
  sections: RenderSection[]
  ticks: NonNullable<LinearAlignmentsDisplayModel['coverageTicks']>
  left: number
}) {
  return (
    <>
      {sections.map(section => (
        <g
          key={sectionKey(section.groupKey)}
          transform={`translate(${left}, ${section.coverageTop})`}
        >
          <YScaleBar ticks={ticks} orientation="left" />
        </g>
      ))}
    </>
  )
}

// Insert-size (TLEN) scale bar, samplot mode only. Down mode puts it on the
// left (matches PileupComponent), up mode on the right; 45/50 match the
// on-screen SVG axis width.
function InsertSizeScaleBar({
  ticks,
  down,
  canvasWidth,
}: {
  ticks: NonNullable<LinearAlignmentsDisplayModel['insertSizeTicks']>
  down: boolean
  canvasWidth: number
}) {
  return (
    <g transform={`translate(${down ? 45 : canvasWidth - 50})`}>
      <YScaleBar ticks={ticks} orientation={down ? 'left' : 'right'} />
      <TlenAxisLabel
        yTop={ticks.yTop}
        yBottom={ticks.yBottom}
        x={down ? 11 : undefined}
      />
    </g>
  )
}

// Group name boxes, one per section. Rendered last (highest z-order) so a
// group's label always sits on top of the pileup/coverage/arcs it labels.
function GroupLabelBoxes({
  sections,
  left,
  theme,
}: {
  sections: RenderSection[]
  left: number
  theme: Theme
}) {
  return (
    <>
      {sections.map(section => (
        <GroupLabelBox
          key={sectionKey(section.groupKey)}
          x={left + 4}
          y={section.coverageTop + 1}
          text={groupSectionLabel(section.label)}
          theme={theme}
        />
      ))}
    </>
  )
}
