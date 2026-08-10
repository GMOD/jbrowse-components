/* eslint-disable react-refresh/only-export-components */
import { Fragment } from 'react'

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
import { bandScreenTop, sectionKey } from './components/sectionScreen.ts'
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

  // The export honors the display's Y scroll, exactly as the canvas and MAF
  // exports do. The pileup scrolls virtually — the surface is only ever the
  // viewport (`VerticalScrollbar` + a `scrollTop` the painters subtract), and
  // this SVG's box is that same `model.height` — so drawing at scrollTop 0
  // didn't export "the full track", it exported the TOP of a pileup the user
  // had scrolled away from. `scrollModel` is the projection every on-screen
  // overlay already shares (`bandScreenTop` / `contentScreenY`), and it carries
  // the sticky-vs-scrolling rule: ungrouped scrolls only the pileup under a
  // pinned coverage band, grouped scrolls whole sections. Reuse it rather than
  // re-deciding here.
  const scroll = model.scrollModel
  // Projected once here, so everything downstream reads a plain screen y and
  // no component below needs to know scroll exists.
  const screenSections = renderSections.map(s => ({
    ...s,
    coverageTop: bandScreenTop(s.coverageTop, scroll),
  }))
  const state = {
    ...baseState,
    canvasWidth,
    canvasHeight: displayHeight,
    colors: buildColorPaletteFromPalette(palette),
    sections: buildSectionRenders(model.sections, {
      scrollTop: scroll.scrollTop,
      canvasHeight: displayHeight,
    }),
  }

  // The same compute as the on-screen getter, now including scrollTop, so read
  // labels ride the reads they name instead of staying pinned to the layout top.
  const labels = computeVisibleLabels({
    view,
    sections: renderSections,
    height: displayHeight,
    featureHeight: model.featureHeight,
    featureSpacing: model.featureSpacing,
    showMismatches: model.showMismatches,
    scrollTop: scroll.scrollTop,
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
          sections={screenSections}
          ticks={coverageTicks}
          left={contentLeft}
          hasGroupLabels={model.showsGroupLabels}
          canvasWidth={canvasWidth}
        />
      ) : null}
      {insertSizeTicks ? (
        <InsertSizeScaleBar
          ticks={insertSizeTicks}
          down={model.readConnectionsDown}
          canvasWidth={canvasWidth}
          // A sticky-capable band top like coverage, so it takes the same
          // projection the on-screen InsertSizeAxisHost applies.
          yShift={bandScreenTop(0, scroll)}
        />
      ) : null}
      {model.showsGroupLabels ? (
        <GroupLabelBoxes
          sections={screenSections}
          left={contentLeft}
          width={canvasWidth}
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

// One coverage y-axis per stacked section's coverage band. Mirrors the
// on-screen `CoverageAxisHost`, which makes a three-way choice: a band under
// COMPACT_AXIS_HEIGHT can't fit tick labels and shows a single `[0, max]`
// right-aligned; a full axis goes right whenever the group label chips are
// drawn, so it clears them, and left otherwise.
//
// The side keys off the chips (`showsGroupLabels`), not off the section count:
// a grouping that yields one named section still draws a chip at the left edge.
//
// `sections` arrive already projected to screen y by the body, so `coverageTop`
// is the section's final y here.
export function CoverageScaleBars({
  sections,
  ticks,
  left,
  hasGroupLabels,
  canvasWidth,
}: {
  sections: RenderSection[]
  ticks: NonNullable<LinearAlignmentsDisplayModel['coverageTicks']>
  left: number
  hasGroupLabels: boolean
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
              hasGroupLabels
                ? rightAxisSpineX(canvasWidth)
                : leftAxisSpineX(left)
            }, ${section.coverageTop})`}
          >
            <YScaleBar
              ticks={ticks}
              orientation={hasGroupLabels ? 'right' : 'left'}
            />
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
  yShift,
}: {
  ticks: NonNullable<LinearAlignmentsDisplayModel['insertSizeTicks']>
  down: boolean
  canvasWidth: number
  yShift: number
}) {
  return down ? (
    <g transform={`translate(0, ${yShift})`}>
      <g transform="translate(40, 0)">
        <YScaleBar ticks={ticks} orientation="left" />
      </g>
      <TlenAxisLabel yTop={ticks.yTop} yBottom={ticks.yBottom} x={11} />
    </g>
  ) : (
    <g transform={`translate(${canvasWidth - 50}, ${yShift})`}>
      <YScaleBar ticks={ticks} orientation="right" />
      <TlenAxisLabel yTop={ticks.yTop} yBottom={ticks.yBottom} />
    </g>
  )
}

// Group name boxes + the rules between sections, one per section. Rendered last
// (highest z-order) so a group's label always sits on top of the
// pileup/coverage/arcs it labels.
//
// The divider is the on-screen overlay's `classes.divider`: without it an
// exported stack of lanes ran together, since the chip is the only other thing
// marking where one group ends — the same drift `groupLabelStyle.ts` exists to
// prevent for the chip itself.
function GroupLabelBoxes({
  sections,
  left,
  width,
  theme,
}: {
  sections: RenderSection[]
  left: number
  width: number
  theme: Theme
}) {
  return (
    <>
      {sections.map((section, i) => (
        <Fragment key={sectionKey(section.groupKey)}>
          {i > 0 ? (
            <line
              x1={0}
              x2={width}
              y1={section.coverageTop}
              y2={section.coverageTop}
              stroke={theme.palette.divider}
              strokeWidth={1}
            />
          ) : null}
          <GroupLabelBox
            x={left + 4}
            y={section.coverageTop + 1}
            text={groupSectionLabel(section.label)}
            theme={theme}
          />
        </Fragment>
      ))}
    </>
  )
}
