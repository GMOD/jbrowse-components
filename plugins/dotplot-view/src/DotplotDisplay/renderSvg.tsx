import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { when } from 'mobx'

import { drawDotplotInstances } from './drawDotplot.ts'

import type { DotplotRenderModel } from './types.ts'
import type { DotplotViewModel } from '../DotplotView/model.ts'

export async function renderSvg(model: DotplotRenderModel) {
  await when(() => !!model.geometry || !!model.error)
  const { geometry } = model
  if (!geometry) {
    return null
  }
  const view = getContainingView(model) as DotplotViewModel
  const { viewHeight, hview, vview } = view

  const ctx = new SvgCanvas()
  ctx.lineWidth = 2
  const viewBpH = hview.offsetPx * hview.bpPerPx
  const viewBpV = vview.offsetPx * vview.bpPerPx
  drawDotplotInstances(ctx, geometry, {
    viewBpH,
    bpPerPxHInv: 1 / hview.bpPerPx,
    viewBpV,
    bpPerPxVInv: 1 / vview.bpPerPx,
    viewHeight,
  })

  return <g dangerouslySetInnerHTML={{ __html: ctx.getSerializedSvg() }} />
}
