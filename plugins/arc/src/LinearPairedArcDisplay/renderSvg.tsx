import { getContainingView, when } from '@jbrowse/core/util'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/core/util/SvgExport'

import Arcs from './components/Arcs.tsx'

import type { LinearPairedArcDisplayModel } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Bezier-arc-overlay exception (see ARCHITECTURE.md "SVG export pipeline"):
// arc paths render as vector SVG on both on-screen and export paths so
// hover/tooltips work natively. The clip wrapper still uses the shared
// SvgClipRect for consistency with every other plugin.
export async function renderArcSvg(
  model: LinearPairedArcDisplayModel,
  _opts: {
    rasterizeLayers?: boolean
  },
) {
  await when(() => model.fetchSettled)
  const view = getContainingView(model) as LinearGenomeViewModel
  const width = view.dynamicBlocks.totalWidthPx
  if (model.error) {
    return <SVGErrorBox error={model.error} width={width} height={model.height} />
  }
  return (
    <SvgClipRect id={`arc-${model.id}`} width={width} height={model.height}>
      <Arcs model={model} exportSVG={true} />
    </SvgClipRect>
  )
}
