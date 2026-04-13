import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import { drawRef } from './drawRef.ts'

import type { LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

export async function renderSvg(model: LinearSyntenyDisplayModel) {
  await when(() => model.featureData != null || !!model.error)
  if (!model.featureData) {
    return null
  }
  const view = getContainingView(model) as LinearSyntenyViewModel
  const ctx = new SvgCanvas()
  drawRef(model, ctx)
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
