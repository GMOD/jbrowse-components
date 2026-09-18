/* eslint-disable react-refresh/only-export-components */
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { GroupLabelBoxes } from '@jbrowse/display-kit/GroupLabelBox'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'

import { getMismatchContrastMap } from '../shared/util.ts'
import CrossRegionArcsSvg from './components/CrossRegionArcsSvg.tsx'
import PileupBezierArcsSvg from './components/PileupBezierArcsSvg.tsx'
import SashimiArcsSvg from './components/SashimiArcsSvg.tsx'
import { buildColorPaletteFromPalette } from './components/alignmentComponentUtils.ts'
import { drawAlignmentLabels } from './components/drawAlignmentLabels.ts'
import { bandScreenTop } from './components/sectionScreen.ts'
import { drawAlignmentsToCtx } from './renderers/Canvas2DAlignmentsRenderer.ts'

import type { LinearAlignmentsDisplayModel } from './model.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type React from 'react'

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
  overlays,
  opts,
}: LgvSvgBodyProps<LinearAlignmentsDisplayModel>) {
  const theme = createJBrowseTheme(opts?.theme)
  // Export colors follow the export theme, not the live session theme, so the
  // pileup matches the labels and contrast that already use it.
  const palette = resolvePalette({ configTheme: opts?.theme })
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
  // The on-screen render state and labels, which already carry the scroll and
  // the display's height; only the width and the export theme's colors differ.
  const state = {
    ...model.renderState,
    canvasWidth,
    colors: buildColorPaletteFromPalette(palette),
  }
  const labels = model.visibleLabels
  const contrastMap = getMismatchContrastMap(model.showModifications, palette)

  // Sashimi and linked-read bezier arcs stay vector SVG by design (low arc
  // count + native hover in the on-screen overlay); these export components
  // share their geometry helpers with the overlays so the paths can't drift.
  return (
    <>
      <PaintLayer
        width={canvasWidth}
        height={height}
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
          if (overlays) {
            drawAlignmentLabels(ctx, labels, contrastMap, palette)
          }
        }}
      />
      {overlays ? (
        <>
          <SashimiArcsSvg model={model} width={canvasWidth} palette={palette} />
          <CrossRegionArcsSvg
            model={model}
            width={canvasWidth}
            colors={state.colors}
          />
          <PileupBezierArcsSvg
            model={model}
            view={model.view}
            width={canvasWidth}
            colors={state.colors}
          />
        </>
      ) : null}
      {overlays && model.showsGroupLabels ? (
        <GroupLabelBoxes
          sections={screenSections.map(s => ({
            key: s.groupKey,
            label: s.label,
            top: s.coverageTop,
            height: s.height,
          }))}
          left={contentLeft}
          width={canvasWidth}
          canvasHeight={scroll.canvasHeight}
          theme={theme}
        />
      ) : null}
    </>
  )
}
