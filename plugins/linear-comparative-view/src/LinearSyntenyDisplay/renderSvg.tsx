import { getContainingView } from '@jbrowse/core/util'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/core/util/SvgExport'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { when } from 'mobx'

import { drawSyntenyTrack } from './Canvas2DSyntenyRenderer.ts'

import type { LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { PaintLayerOpts } from '@jbrowse/core/util/paintLayer'

export async function renderSvg(
  model: LinearSyntenyDisplayModel,
  opts?: PaintLayerOpts,
) {
  await when(() => model.featureData != null || !!model.error)
  const view = getContainingView(model) as LinearSyntenyViewModel
  if (model.error) {
    return (
      <SVGErrorBox
        error={model.error}
        width={view.width}
        height={model.height}
      />
    )
  }
  if (!model.featureData) {
    return null
  }
  const data = model.renderInstanceData
  const params = model.renderParams
  if (!data || !params || data.instanceCount === 0) {
    return null
  }
  // paintLayer dispatches to a 2× raster canvas when opts.rasterizeLayers is
  // set, falling back to SvgCanvas otherwise. drawSyntenyTrack duck-types
  // against either Ctx2D variant and draws in logical coords (paintLayer's
  // canvas is pre-scaled), so the same draw path runs identically here and in
  // the interactive Canvas2D backend.
  const node = paintLayer(view.width, model.height, opts, ctx => {
    drawSyntenyTrack(ctx, data, params, view.width, view.overdrawPx)
  })
  return (
    <SvgClipRect
      id={`synteny-clip-${model.id}`}
      width={view.width}
      height={model.height}
    >
      {node}
    </SvgClipRect>
  )
}
