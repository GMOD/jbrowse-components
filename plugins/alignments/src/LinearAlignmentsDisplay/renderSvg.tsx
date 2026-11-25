/* eslint-disable react-refresh/only-export-components */
import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { getFillProps } from '@jbrowse/core/util/svgColorProps'
import { GroupLabelBoxes } from '@jbrowse/display-kit/GroupLabelBox'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'

import JunctionLabels from './components/JunctionLabels.tsx'
import { drawAlignmentLabels } from './components/drawAlignmentLabels.ts'
import { bandScreenTop } from './components/sectionScreen.ts'
import { CUT_CAPTION_LINE_PX } from './exportPileupCut.ts'
import { drawAlignmentsToCtx } from './renderers/Canvas2DAlignmentsRenderer.ts'
import { junctionLabels } from './renderers/junctionMarks.ts'

import type { ColorPalette } from '../shaders/colors.ts'
import type { VisibleLabel } from './components/computeVisibleLabels.ts'
import type { ScrollModel } from './components/sectionScreen.ts'
import type { PileupCut } from './exportPileupCut.ts'
import type { AlignmentLane } from './lanes.ts'
import type {
  DisplayRenderState,
  SectionSource,
} from './renderers/rendererTypes.ts'
import type { Section } from './sectionLayout.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type {
  LgvSvgBodyProps,
  LgvSvgExportable,
} from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type React from 'react'

interface AlignmentsSvgModel extends LgvSvgExportable {
  renderSections: readonly Pick<
    AlignmentLane & Section,
    'groupKey' | 'label' | 'sectionTop' | 'height'
  >[]
  svgPileupCut: PileupCut
  scrollModel: ScrollModel
  themedIn: (palette: JBrowsePalette) => {
    colors: ColorPalette
    sourceSections: SectionSource[]
  }
  renderState: DisplayRenderState
  visibleLabels: VisibleLabel[]
  showJunctionLabels: boolean
  showsGroupLabels: boolean
  groupChipLabel: (label: string) => string
}

export async function renderSvg(
  model: AlignmentsSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  // renderDisplaySvg's awaitSvgReady waits for ALL visible regions, not just the
  // first to stream in, so whole-genome / multi-region exports aren't partially
  // drawn.
  return renderDisplaySvg(model, opts, AlignmentsSvgBody)
}

// the on-screen truncation caption's size
const CUT_CAPTION_FONT_SIZE = 10

// An empty (zero-read) region draws an empty pileup + coverage axis here, so
// this body renders unconditionally: there's no data-size gate. Readiness and
// the error terminal are already handled upstream (awaitSvgReady / SvgChrome).
function AlignmentsSvgBody({
  model,
  view,
  height,
  canvasWidth,
  renderBlocks,
  overlays,
  opts,
}: LgvSvgBodyProps<AlignmentsSvgModel>) {
  const palette = usePalette()
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
    sectionTop: bandScreenTop(s.sectionTop, scroll),
  }))
  // The on-screen render state and labels, which already carry the scroll and
  // the display's height; only the width and the export theme's colors differ.
  const themed = model.themedIn(palette)
  const state = { ...model.renderState, canvasWidth, colors: themed.colors }
  const labels = model.visibleLabels
  const sections = themed.sourceSections
  const junctionCounts = model.showJunctionLabels
    ? junctionLabels(
        state,
        sections.map(sec => sec.junctionFeeds),
      )
    : []
  const cut = model.svgPileupCut

  // The arcs and connectors paint into the canvas with the reads; the junctions
  // count labels are vector SVG on screen too, and share their geometry with
  // the overlay so the two can't drift. The per-base letters and counts get a
  // layer of their own without `opts`, so they stay text over rasterized reads.
  const body = (
    <>
      <PaintLayer
        width={canvasWidth}
        height={height}
        opts={opts}
        paint={ctx => {
          drawAlignmentsToCtx(
            ctx,
            {
              sections,
            },
            renderBlocks,
            state,
          )
        }}
      />
      {overlays ? (
        <PaintLayer
          width={canvasWidth}
          height={height}
          paint={ctx => {
            drawAlignmentLabels(ctx, labels, state, palette)
          }}
        />
      ) : null}
      {overlays ? <JunctionLabels labels={junctionCounts} /> : null}
      {overlays && model.showsGroupLabels ? (
        <GroupLabelBoxes
          sections={screenSections.map(s => ({
            key: s.groupKey,
            label: model.groupChipLabel(s.label),
            top: s.sectionTop,
            height: s.height,
          }))}
          left={contentLeft}
          width={canvasWidth}
          canvasHeight={scroll.canvasHeight}
        />
      ) : null}
    </>
  )
  return overlays && cut.caption ? (
    <>
      <SvgClipRect
        id={`pileup-cut-${svgNodeId(model)}`}
        width={canvasWidth}
        height={cut.cutY}
      >
        {body}
      </SvgClipRect>
      <text
        data-testid="pileup-cut-caption"
        x={contentLeft + 4}
        y={height - (CUT_CAPTION_LINE_PX - CUT_CAPTION_FONT_SIZE)}
        fontSize={CUT_CAPTION_FONT_SIZE}
        {...getFillProps(palette.text.secondary)}
      >
        {cut.caption}
      </text>
    </>
  ) : (
    body
  )
}
