import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { when } from 'mobx'

import { unpackColorToCSS } from './dotplotWebGLColors.ts'

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
  const scaleX = geometry.bpPerPxH / hview.bpPerPx
  const scaleY = geometry.bpPerPxV / vview.bpPerPx
  const offX = hview.offsetPx
  const offY = vview.offsetPx

  const ctx = new SvgCanvas()
  ctx.lineWidth = 2
  for (let i = 0; i < geometry.instanceCount; i++) {
    ctx.strokeStyle = unpackColorToCSS(geometry.colors[i]!)
    ctx.beginPath()
    ctx.moveTo(geometry.x1s[i]!, geometry.y1s[i]!)
    ctx.lineTo(geometry.x2s[i]!, geometry.y2s[i]!)
    ctx.stroke()
  }

  return (
    <g
      transform={`translate(0,${viewHeight}) scale(${scaleX},-${scaleY}) translate(${-offX},${-offY})`}
    >
      <g dangerouslySetInnerHTML={{ __html: ctx.getSerializedSvg() }} />
    </g>
  )
}
