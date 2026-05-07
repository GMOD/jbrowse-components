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
  drawDotplotInstances(ctx, geometry, {
    scaleX: geometry.bpPerPxH / hview.bpPerPx,
    scaleY: geometry.bpPerPxV / vview.bpPerPx,
    offsetX: hview.offsetPx,
    offsetY: vview.offsetPx,
    viewHeight,
  })

  return <g dangerouslySetInnerHTML={{ __html: ctx.getSerializedSvg() }} />
}
