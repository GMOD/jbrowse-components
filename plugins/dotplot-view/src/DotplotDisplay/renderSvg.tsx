import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox } from '@jbrowse/core/util/svgExport'
import { when } from 'mobx'

import { drawDotplotInstances } from './drawDotplot.ts'

import type { DotplotRenderModel } from './types.ts'
import type { DotplotViewModel } from '../DotplotView/model.ts'
import type { PaintLayerOpts } from '@jbrowse/core/util/paintLayer'

export async function renderSvg(
  model: DotplotRenderModel,
  opts?: PaintLayerOpts,
) {
  await when(() => !!model.geometry || !!model.error)
  const view = getContainingView(model) as DotplotViewModel
  const { viewWidth, viewHeight, hview, vview } = view
  if (model.error) {
    return <SVGErrorBox error={model.error} width={viewWidth} height={viewHeight} />
  }
  const { geometry } = model
  if (!geometry) {
    return null
  }
  const viewBpH = hview.offsetPx * hview.bpPerPx
  const viewBpV = vview.offsetPx * vview.bpPerPx
  return paintLayer(viewWidth, viewHeight, opts, ctx => {
    ctx.lineWidth = 2
    drawDotplotInstances(ctx, geometry, {
      viewBpH,
      bpPerPxHInv: 1 / hview.bpPerPx,
      viewBpV,
      bpPerPxVInv: 1 / vview.bpPerPx,
      viewHeight,
    })
  })
}
