import { getContainingView, when } from '@jbrowse/core/util'
import { SvgClipRect } from '@jbrowse/core/util/svgExport'

import Arcs from './components/Arcs.tsx'

import type { LinearArcDisplayModel } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Bezier-arc-overlay exception (see ARCHITECTURE.md "SVG export pipeline"):
// arc paths render as vector SVG on both on-screen and export paths so
// hover/tooltips work natively. The clip wrapper still uses the shared
// SvgClipRect for consistency with every other plugin.
export async function renderArcSvg(
  model: LinearArcDisplayModel,
  _opts: {
    rasterizeLayers?: boolean
  },
) {
  await when(() => !model.loading)
  const view = getContainingView(model) as LinearGenomeViewModel
  return (
    <SvgClipRect
      id={`arc-${model.id}`}
      width={view.dynamicBlocks.totalWidthPx}
      height={model.height}
    >
      <Arcs model={model} exportSVG={true} />
    </SvgClipRect>
  )
}
