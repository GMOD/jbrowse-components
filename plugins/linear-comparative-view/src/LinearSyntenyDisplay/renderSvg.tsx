import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { when } from 'mobx'

import { drawRef } from './drawRef.ts'

import type { LinearSyntenyDisplayModel } from './model.ts'

export async function renderSvg(model: LinearSyntenyDisplayModel) {
  await when(() => model.featureData != null || !!model.error)
  if (!model.featureData) {
    return null
  }
  const ctx = new SvgCanvas()
  drawRef(model, ctx)
  return <g dangerouslySetInnerHTML={{ __html: ctx.getSerializedSvg() }} />
}
