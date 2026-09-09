/* eslint-disable react-refresh/only-export-components */
import { Fragment } from 'react'

import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'

import { getMismatchContrastMap } from '../shared/util.ts'
import CrossRegionArcsSvg from './components/CrossRegionArcsSvg.tsx'
import PileupBezierArcsSvg from './components/PileupBezierArcsSvg.tsx'
import SashimiArcsSvg from './components/SashimiArcsSvg.tsx'
import { buildColorPaletteFromPalette } from './components/alignmentComponentUtils.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { drawAlignmentLabels } from './components/drawAlignmentLabels.ts'
import { bandScreenTop, sectionKey } from './components/sectionScreen.ts'
import {
  GROUP_LABEL_INSET_X,
  groupChipTop,
  groupSectionLabel,
} from './groupLabelStyle.ts'
import { drawAlignmentsToCtx } from './renderers/Canvas2DAlignmentsRenderer.ts'
import { buildSectionRenders } from './sectionLayout.ts'
import GroupLabelBox from './svgcomponents/GroupLabelBox.tsx'

import type { ScrollModel } from './components/sectionScreen.ts'
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
  const { renderSections } = model
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
                densityRegions: model.densityCoverageRegions,
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
      {model.showsGroupLabels ? (
        <GroupLabelBoxes
          sections={screenSections}
          left={contentLeft}
          width={canvasWidth}
          theme={theme}
          scroll={scroll}
        />
      ) : null}
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
  scroll,
}: {
  sections: RenderSection[]
  left: number
  width: number
  theme: Theme
  scroll: ScrollModel
}) {
  return (
    <>
      {sections.map((section, i) => {
        const chipTop = groupChipTop(
          section.coverageTop,
          section.height,
          scroll,
        )
        return (
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
            {chipTop === undefined ? null : (
              <GroupLabelBox
                x={left + GROUP_LABEL_INSET_X}
                y={chipTop + 1}
                text={groupSectionLabel(section.label)}
                theme={theme}
              />
            )}
          </Fragment>
        )
      })}
    </>
  )
}
