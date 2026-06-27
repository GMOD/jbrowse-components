import { getContainingView } from '@jbrowse/core/util'
import {
  SvgChrome,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'

import Arcs from './components/Arcs.tsx'

import type { LinearPairedArcDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// Bezier-arc-overlay exception (see ARCHITECTURE.md "SVG export pipeline"): arc
// paths render as vector SVG on both on-screen and export paths so
// hover/tooltips work natively, so the body returns JSX directly rather than
// routing through paintLayer. SvgChrome still owns the shared SVGErrorBox
// terminal state and SvgClipRect the clip wrapper, so arc shares the same
// contract as every other LGV track display; the svgReady gate stays an
// explicit await at the top.
export async function renderArcSvg(
  model: LinearPairedArcDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  await awaitSvgReady(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const height = opts?.overrideHeight ?? model.height
  return (
    <SvgChrome error={model.error} width={view.width} height={height}>
      <SvgClipRect
        id={`arc-${model.id}`}
        width={view.totalWidthPx}
        height={height}
      >
        <Arcs model={model} exportSVG={true} />
      </SvgClipRect>
    </SvgChrome>
  )
}
