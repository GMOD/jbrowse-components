import { getContainingView } from '@jbrowse/core/util'
import {
  buildViewProjection,
  projectBpToScreenPx,
} from '@jbrowse/core/util/bpProjection'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { when } from 'mobx'

import type { DotplotRenderModel } from './types.ts'
import type { DotplotViewModel } from '../DotplotView/model.ts'

// colors are packed as uint32 in ABGR layout (R in bits 0-7)
function unpackColor(packed: number) {
  const r = packed & 0xff
  const g = (packed >> 8) & 0xff
  const b = (packed >> 16) & 0xff
  const a = ((packed >>> 24) & 0xff) / 255
  return `rgba(${r},${g},${b},${a})`
}

export async function renderSvg(model: DotplotRenderModel) {
  await when(() => !!model.geometry || !!model.error)
  const { geometry } = model
  if (!geometry) {
    return null
  }
  const view = getContainingView(model) as DotplotViewModel
  const { viewHeight, hview, vview } = view
  const projH = buildViewProjection(hview)
  const projV = buildViewProjection(vview)

  const ctx = new SvgCanvas()
  ctx.lineWidth = 2
  for (let i = 0; i < geometry.instanceCount; i++) {
    const xRegIdx = geometry.xRegionIdx[i]!
    const yRegIdx = geometry.yRegionIdx[i]!
    const sx1 = projectBpToScreenPx(geometry.x1s[i]!, xRegIdx, projH)
    const sy1 = viewHeight - projectBpToScreenPx(geometry.y1s[i]!, yRegIdx, projV)
    const sx2 = projectBpToScreenPx(geometry.x2s[i]!, xRegIdx, projH)
    const sy2 = viewHeight - projectBpToScreenPx(geometry.y2s[i]!, yRegIdx, projV)
    ctx.strokeStyle = unpackColor(geometry.colors[i]!)
    ctx.beginPath()
    ctx.moveTo(sx1, sy1)
    ctx.lineTo(sx2, sy2)
    ctx.stroke()
  }

  return <g dangerouslySetInnerHTML={{ __html: ctx.getSerializedSvg() }} />
}
