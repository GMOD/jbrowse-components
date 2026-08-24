/* eslint-disable react-refresh/only-export-components */
import { Fragment } from 'react'

import { svgNodeId } from '@jbrowse/core/svg/svgId'
import {
  SvgColorLegend,
  createJBrowseTheme,
  legendEntries,
} from '@jbrowse/core/ui'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { YScaleBar } from '@jbrowse/wiggle-core'

import { getAlignmentsLegendSections } from '../shared/legendUtils.ts'
import { getMismatchContrastMap } from '../shared/util.ts'
import CrossRegionArcsSvg from './components/CrossRegionArcsSvg.tsx'
import { InsertSizeAxisStack } from './components/InsertSizeAxis.tsx'
import PileupBezierArcsSvg from './components/PileupBezierArcsSvg.tsx'
import SashimiArcsSvg from './components/SashimiArcsSvg.tsx'
import { buildColorPaletteFromPalette } from './components/alignmentComponentUtils.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { drawAlignmentLabels } from './components/drawAlignmentLabels.ts'
import { bandScreenTop, sectionKey } from './components/sectionScreen.ts'
import {
  COMPACT_AXIS_HEIGHT,
  compactAxisLabel,
  insertSizeAxisBoxLeft,
  leftAxisSpineX,
  rightAxisLabelX,
  rightAxisSpineX,
} from './coverageAxisStyle.ts'
import { groupSectionLabel } from './groupLabelStyle.ts'
import { drawAlignmentsToCtx } from './renderers/Canvas2DAlignmentsRenderer.ts'
import { buildSectionRenders } from './sectionLayout.ts'
import GroupLabelBox from './svgcomponents/GroupLabelBox.tsx'

import type { LinearAlignmentsDisplayModel } from './model.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
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
  renderBlocks,
  opts,
}: LgvSvgBodyProps<LinearAlignmentsDisplayModel>) {
  const theme = createJBrowseTheme(opts?.theme)
  // Export colors follow the export theme, not the live session theme, so the
  // pileup matches the labels and contrast that already use it.
  const palette = resolvePalette({ configTheme: opts?.theme })
  const baseState = model.renderState
  const displayHeight = height
  const { coverageTicks, insertSizeTickSections, renderSections } = model
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
    mismatchAlpha: model.mismatchAlpha,
    scrollTop: scroll.scrollTop,
  })
  const contrastMap = getMismatchContrastMap(model.showModifications, palette)

  // Sashimi and linked-read bezier arcs stay vector SVG by design (low arc
  // count + native hover in the on-screen overlay); these export components
  // share their geometry helpers with the overlays so the paths can't drift.
  return (
    <>
      <SvgClipRect
        id={`alignments-clip-${svgNodeId(model)}`}
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
                readConnectionsLineWidth: model.readConnectionsLineWidth,
              },
              renderBlocks,
              state,
            )
            drawAlignmentLabels(ctx, labels, contrastMap, palette)
          }}
        />
        <SashimiArcsSvg model={model} width={canvasWidth} palette={palette} />
        <CrossRegionArcsSvg model={model} width={canvasWidth} />
        <PileupBezierArcsSvg model={model} view={model.view} />
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
      {/* Insert-size (TLEN) scale bars, read-cloud mode only — one per section
          that reserves an arc band, the way CoverageScaleBars does for
          coverage. All this supplies that the on-screen host doesn't is `x`:
          the export has no CSS box to anchor the axis in. The shift is the same
          sticky-capable band-top projection. */}
      {insertSizeTickSections.length > 0 ? (
        <InsertSizeAxisStack
          sections={insertSizeTickSections}
          down={model.readConnectionsDown}
          yShift={bandScreenTop(0, scroll)}
          x={insertSizeAxisBoxLeft(canvasWidth, model.readConnectionsDown)}
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
// COMPACT_AXIS_HEIGHT can't fit tick labels and shows a single `[min, max]`
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
            {compactAxisLabel(ticks)}
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
