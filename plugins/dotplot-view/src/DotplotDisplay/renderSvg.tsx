import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox } from '@jbrowse/core/util/svgExport'
import { when } from 'mobx'

import { drawDotplotInstances } from './drawDotplot.ts'

import type { DotplotRenderModel } from './types.ts'
import type { PaintLayerOpts } from '@jbrowse/core/util/paintLayer'

interface RenderSvgView {
  viewWidth: number
  viewHeight: number
  lineWidth: number
  hview: { offsetPx: number; bpPerPx: number }
  vview: { offsetPx: number; bpPerPx: number }
}

export async function renderSvg(
  model: DotplotRenderModel,
  opts?: PaintLayerOpts,
) {
  await when(() => !!model.geometry || !!model.error)
  const view = getContainingView(model) as unknown as RenderSvgView
  const { viewWidth, viewHeight, hview, vview, lineWidth } = view
  if (model.error) {
    return (
      <SVGErrorBox error={model.error} width={viewWidth} height={viewHeight} />
    )
  }
  const { geometry } = model
  if (!geometry) {
    return null
  }
  const viewBpH = hview.offsetPx * hview.bpPerPx
  const viewBpV = vview.offsetPx * vview.bpPerPx
  return paintLayer(viewWidth, viewHeight, opts, ctx => {
    drawDotplotInstances(ctx, geometry, {
      viewBpH,
      bpPerPxHInv: 1 / hview.bpPerPx,
      viewBpV,
      bpPerPxVInv: 1 / vview.bpPerPx,
      viewHeight,
      lineWidth,
    })
  })
}
