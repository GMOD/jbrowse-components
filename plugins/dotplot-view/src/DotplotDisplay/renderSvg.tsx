import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { when } from 'mobx'

import { createDotplotColorFunction } from './dotplotWebGLColors.ts'
import { buildLineSegments } from './drawDotplotWebGL.ts'

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
  await when(() => model.featPositions.length > 0 || !!model.error)
  const view = getContainingView(model) as DotplotViewModel
  const { viewHeight, hview, vview, drawCigar } = view
  const {
    featPositions,
    featPositionsBpPerPxH,
    featPositionsBpPerPxV,
    alpha,
    minAlignmentLength,
    colorBy,
  } = model

  if (!featPositions.length) {
    return null
  }

  let filtered = featPositions
  if (minAlignmentLength > 0) {
    filtered = featPositions.filter(
      fp => Math.abs(fp.f.get('end') - fp.f.get('start')) >= minAlignmentLength,
    )
  }

  const hBpPerPx = hview.bpPerPx
  const vBpPerPx = vview.bpPerPx
  const colorFn = createDotplotColorFunction(colorBy, alpha)
  const segments = buildLineSegments(
    filtered,
    colorFn,
    drawCigar,
    hBpPerPx,
    vBpPerPx,
  )

  const scaleX =
    featPositionsBpPerPxH > 0 ? featPositionsBpPerPxH / hBpPerPx : 1
  const scaleY =
    featPositionsBpPerPxV > 0 ? featPositionsBpPerPxV / vBpPerPx : 1

  const offX = hview.offsetPx
  const offY = vview.offsetPx

  const ctx = new SvgCanvas()
  ctx.lineWidth = 2
  for (let i = 0; i < segments.x1s.length; i++) {
    ctx.strokeStyle = unpackColor(segments.colors[i]!)
    ctx.beginPath()
    ctx.moveTo(segments.x1s[i]!, segments.y1s[i]!)
    ctx.lineTo(segments.x2s[i]!, segments.y2s[i]!)
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
