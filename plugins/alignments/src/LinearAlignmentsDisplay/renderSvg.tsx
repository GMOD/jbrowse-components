/* eslint-disable react-refresh/only-export-components */
import {
  SvgColorLegend,
  createJBrowseTheme,
  legendEntries,
} from '@jbrowse/core/ui'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgClipRect,
  renderDisplaySvg,
} from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { YScaleBar } from '@jbrowse/wiggle-core'

import { getAlignmentsLegendSections } from '../shared/legendUtils.ts'
import { getMismatchContrastMap } from '../shared/util.ts'
import PileupBezierArcsSvg from './components/PileupBezierArcsSvg.tsx'
import SashimiArcsSvg from './components/SashimiArcsSvg.tsx'
import TlenAxisLabel from './components/TlenAxisLabel.tsx'
import { buildColorPaletteFromPalette } from './components/alignmentComponentUtils.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { drawAlignmentLabels } from './components/drawAlignmentLabels.ts'
import { sectionKey } from './components/sectionScreen.ts'
import {
  COMPACT_AXIS_HEIGHT,
  compactAxisLabel,
  leftAxisSpineX,
  rightAxisLabelX,
  rightAxisSpineX,
} from './coverageAxisStyle.ts'
import { groupSectionLabel } from './groupLabelStyle.ts'
import { drawAlignmentsToCtx } from './renderers/Canvas2DAlignmentsRenderer.ts'
import { buildSectionRenders } from './sectionLayout.ts'
import GroupLabelBox from './svgcomponents/GroupLabelBox.tsx'

import type { LinearAlignmentsDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LgvSvgBodyProps,
} from '@jbrowse/plugin-linear-genome-view'
import type { Theme } from '@mui/material'
import type React from 'react'

type RenderSection = LinearAlignmentsDisplayModel['renderSections'][number]

export async function renderSvg(
  model: LinearAlignmentsDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  // renderDisplaySvg's awaitSvgReady waits for ALL visible regions, not just the
  // first to stream in, so whole-genome / multi-region exports aren't partially
  // drawn.
  return renderDisplaySvg(model, opts, AlignmentsSvgBody)
}

// An empty (zero-read) region draws an empty pileup + coverage axis here, so
// this body renders unconditionally: there's no data-size gate. Readiness and
// the error terminal are already handled upstream (awaitSvgReady / SvgChrome).
function AlignmentsSvgBody({
  model,
  view,
  height,
  canvasWidth,
  opts,
}: LgvSvgBodyProps<LinearAlignmentsDisplayModel>) {
  const theme = createJBrowseTheme(opts?.theme)
  // Export colors follow the export theme, not the live session theme, so the
  // pileup matches the labels and contrast that already use it.
  const palette = resolvePalette({ configTheme: opts?.theme })
  const baseState = model.renderState
  const displayHeight = height
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const { coverageTicks, insertSizeTicks, renderSections } = model
  // anchors the left-edge scale bars / group labels to the content; non-zero
  // only when scrolled before the genome start
  const contentLeft = Math.max(-view.offsetPx, 0)

  // SVG export renders the full display from y=0 with no Y scroll. Reuse the
  // model's renderState, overriding only the viewport-related fields. The
  // section geometry is rebuilt at scrollTop 0 so grouped coverage bands aren't
  // shifted off-screen (no-op for the ungrouped single-section case).
  const state = {
    ...baseState,
    scrollTop: 0,
    canvasWidth,
    canvasHeight: displayHeight,
    colors: buildColorPaletteFromPalette(palette),
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
  const contrastMap = getMismatchContrastMap(model.showModifications, palette)

  // Sashimi and linked-read bezier arcs stay vector SVG by design (low arc
  // count + native hover in the on-screen overlay); these export components
  // share their geometry helpers with the overlays so the paths can't drift.
  return (
    <>
      <SvgClipRect
        id={`alignments-clip-${model.id}`}
        width={canvasWidth}
        height={displayHeight}
      >
        <PaintLayer
          width={canvasWidth}
          height={displayHeight}
          opts={opts}
          paint={ctx => {
            drawAlignmentsToCtx(
              ctx,
              {
                sections: model.sourceSections,
              },
              renderBlocks,
              state,
            )
            drawAlignmentLabels(ctx, labels, contrastMap, palette)
          }}
        />
        <SashimiArcsSvg model={model} palette={palette} />
        <PileupBezierArcsSvg model={model} view={view} />
      </SvgClipRect>
      {model.showCoverage && coverageTicks ? (
        <CoverageScaleBars
          sections={renderSections}
          ticks={coverageTicks}
          left={contentLeft}
          grouped={model.isGrouped}
          canvasWidth={canvasWidth}
        />
      ) : null}
      {insertSizeTicks ? (
        <InsertSizeScaleBar
          ticks={insertSizeTicks}
          down={model.readConnectionsDown}
          canvasWidth={canvasWidth}
        />
      ) : null}
      {model.showsGroupLabels ? (
        <GroupLabelBoxes
          sections={renderSections}
          left={contentLeft}
          theme={theme}
        />
      ) : null}
      {model.showLegend ? (
        <ColorKey
          model={model}
          canvasWidth={canvasWidth}
          maxHeight={displayHeight}
        />
      ) : null}
    </>
  )
}

// The same color key the display shows on screen (`LegendHost` /
// `FloatingLegend`). Without it an exported figure has colored reads and nothing
// saying what the colors mean, which is decisive for color-by-tag and
// color-by-modification, where the swatches are the only decoder. Vector, via
// the shared `SvgColorLegend` the canvas and HiC exports already use, and
// floated over the right edge of the plot so it lands where the on-screen legend
// does. No `onDismiss`: an exported legend can't be clicked.
//
// Both paths read the same section list and flatten it the same way — titled
// sections become color-less heading rows — so a heading the live legend shows
// can't go missing here.
function ColorKey({
  model,
  canvasWidth,
  maxHeight,
}: {
  model: LinearAlignmentsDisplayModel
  canvasWidth: number
  maxHeight: number
}) {
  return (
    <SvgColorLegend
      entries={legendEntries({ sections: getAlignmentsLegendSections(model) })}
      canvasWidth={canvasWidth}
      maxHeight={maxHeight}
      testid="alignments-color-legend"
    />
  )
}

// One coverage y-axis per stacked section's coverage band. Export is always at
// scrollTop 0, so each `coverageTop` is the section's final y. Mirrors the
// on-screen `CoverageAxisHost`, which makes a three-way choice: a band under
// COMPACT_AXIS_HEIGHT can't fit tick labels and shows a single `[0, max]`
// right-aligned; a full axis goes right when grouped, so it clears the group
// label chips, and left otherwise.
export function CoverageScaleBars({
  sections,
  ticks,
  left,
  grouped,
  canvasWidth,
}: {
  sections: RenderSection[]
  ticks: NonNullable<LinearAlignmentsDisplayModel['coverageTicks']>
  left: number
  grouped: boolean
  canvasWidth: number
}) {
  return (
    <>
      {sections.map(section =>
        section.coverageHeight < COMPACT_AXIS_HEIGHT ? (
          <text
            key={sectionKey(section.groupKey)}
            x={rightAxisLabelX(canvasWidth)}
            y={section.coverageTop + 10}
            fontSize={9}
            fontFamily="sans-serif"
            textAnchor="end"
          >
            {compactAxisLabel(ticks.items.at(-1)?.value ?? 0)}
          </text>
        ) : (
          <g
            key={sectionKey(section.groupKey)}
            transform={`translate(${
              grouped ? rightAxisSpineX(canvasWidth) : leftAxisSpineX(left)
            }, ${section.coverageTop})`}
          >
            <YScaleBar ticks={ticks} orientation={grouped ? 'right' : 'left'} />
          </g>
        ),
      )}
    </>
  )
}

// Insert-size (TLEN) scale bar, read-cloud mode only. Down mode puts it on the
// left, up mode on the right, mirroring PileupComponent's InsertSizeAxisHost.
// Down mode nests only the axis (left-orientation labels grow leftward from
// x=40) so the TLEN label stays at x=11 to the left of them, matching on-screen;
// wrapping the label in the axis translate would push it to the wrong side.
function InsertSizeScaleBar({
  ticks,
  down,
  canvasWidth,
}: {
  ticks: NonNullable<LinearAlignmentsDisplayModel['insertSizeTicks']>
  down: boolean
  canvasWidth: number
}) {
  return down ? (
    <g>
      <g transform="translate(40, 0)">
        <YScaleBar ticks={ticks} orientation="left" />
      </g>
      <TlenAxisLabel yTop={ticks.yTop} yBottom={ticks.yBottom} x={11} />
    </g>
  ) : (
    <g transform={`translate(${canvasWidth - 50})`}>
      <YScaleBar ticks={ticks} orientation="right" />
      <TlenAxisLabel yTop={ticks.yTop} yBottom={ticks.yBottom} />
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
