import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import { drawSyntenyTrack } from './Canvas2DSyntenyRenderer.ts'

import type { LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

export async function renderSvg(model: LinearSyntenyDisplayModel) {
  await when(() => model.featureData != null || !!model.error)
  if (!model.featureData) {
    return null
  }
  const view = getContainingView(model) as LinearSyntenyViewModel
  const data = model.renderInstanceData
  const params = model.renderParams
  if (!data || !params || data.instanceCount === 0) {
    return null
  }
  // SvgCanvas duck-types as CanvasRenderingContext2D so the same draw path
  // (slope-aware widening, edge culling, hover/click styling) renders SVG
  // export identically to the on-screen Canvas2D backend.
  const ctx = new SvgCanvas()
  drawSyntenyTrack(ctx, data, params, view.width, view.maxOffScreenDrawPx)
  return (
    <SvgClipRect
      id={`synteny-clip-${model.id}`}
      width={view.width}
      height={model.height}
    >
      <g dangerouslySetInnerHTML={{ __html: ctx.getSerializedSvg() }} />
    </SvgClipRect>
  )
}
