import { SvgClipRect, renderSvgChrome } from '@jbrowse/plugin-linear-genome-view'

import Arcs from './components/Arcs.tsx'

import type { LinearPairedArcDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// Bezier-arc-overlay exception (see ARCHITECTURE.md "SVG export pipeline"): arc
// paths render as vector SVG on both on-screen and export paths so
// hover/tooltips work natively, so the body returns JSX directly rather than
// routing through paintLayer. renderSvgChrome still owns the shared svgReady
// gate + SVGErrorBox preamble, and SvgClipRect the clip wrapper, so arc shares
// the same terminal-state contract as every other LGV track display.
export async function renderArcSvg(
  model: LinearPairedArcDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderSvgChrome<LinearGenomeViewModel>(model, opts, (view, height) => (
    <SvgClipRect
      id={`arc-${model.id}`}
      width={view.totalWidthPx}
      height={height}
    >
      <Arcs model={model} exportSVG={true} />
    </SvgClipRect>
  ))
}
