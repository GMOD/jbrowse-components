import { getContainingView } from '@jbrowse/core/util'

import { drawMatchSimple } from './components/util.ts'
import { oobLimit } from './drawSyntenyUtils.ts'

import type { LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

export function drawMouseoverClickMap(model: LinearSyntenyDisplayModel) {
  const { level, clickId, mouseoverId } = model
  const view = getContainingView(model) as LinearSyntenyViewModel
  const drawCurves = view.drawCurves
  const height = model.height
  const width = view.width
  const ctx = model.mouseoverCanvas?.getContext('2d')
  const offsets = view.views.map(v => v.offsetPx)

  if (!ctx) {
    return
  }
  ctx.resetTransform()
  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'

  const feature1 = model.featMap[mouseoverId || '']
  if (feature1) {
    drawMatchSimple({
      cb: ctx => {
        ctx.fill()
      },
      feature: feature1,
      level,
      ctx,
      oobLimit,
      viewWidth: view.width,
      drawCurves,
      offsets,
      height,
    })
  }

  const feature2 = model.featMap[clickId || '']
  if (feature2) {
    drawMatchSimple({
      cb: ctx => {
        ctx.stroke()
      },
      feature: feature2,
      ctx,
      level,
      oobLimit,
      viewWidth: view.width,
      drawCurves,
      offsets,
      height,
    })
  }
}
