import { SvgChrome } from '@jbrowse/core/svg/SvgExport'
import { awaitSvgReady } from '@jbrowse/core/svg/svgReady'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'

import { drawSyntenyTrack } from './Canvas2DSyntenyRenderer.ts'

import type { LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { PaintLayerOpts } from '@jbrowse/core/util/paintLayer'

export async function renderSvg(
  model: LinearSyntenyDisplayModel,
  opts?: PaintLayerOpts,
) {
  await awaitSvgReady(model)
  const view = getContainingView(model) as LinearSyntenyViewModel
  const data = model.renderInstanceData
  const params = model.renderParams
  // paintLayer dispatches to a 2× raster canvas when opts.rasterizeLayers is
  // set, falling back to SvgCanvas otherwise. drawSyntenyTrack duck-types
  // against either Ctx2D variant and draws in logical coords (paintLayer's
  // canvas is pre-scaled), so the same draw path runs identically here and in
  // the interactive Canvas2D backend. Horizontal overdraw is clipped by the
  // enclosing SVGSyntenyLevel's SvgClipRect, so no per-display clip is needed.
  // Narrow the genuinely-nullable derived data (undefined until instanceData +
  // colors resolve); no data-size gate — drawSyntenyTrack draws nothing for an
  // instanceCount of 0, so an empty level paints empty naturally.
  const body =
    data && params
      ? paintLayer(view.width, model.height, opts, ctx => {
          drawSyntenyTrack(ctx, data, params, view.width, view.overdrawPx)
        })
      : null
  return (
    <SvgChrome error={model.error} width={view.width} height={model.height}>
      {body}
    </SvgChrome>
  )
}
