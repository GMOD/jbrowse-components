import { getContainingView } from '@jbrowse/core/util'
import { when } from 'mobx'

import { createDotplotColorFunction } from './dotplotWebGLColors.ts'
import { buildLineSegments } from './drawDotplotWebGL.ts'

import type { DotplotDisplayModel } from './stateModelFactory.tsx'
import type { DotplotViewModel } from '../DotplotView/model.ts'

function rgbaToCSS(r: number, g: number, b: number, a: number) {
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`
}

export async function renderSvg(model: DotplotDisplayModel) {
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

  let content = ''
  for (let i = 0; i < segments.x1s.length; i++) {
    const ci = i * 4
    const color = rgbaToCSS(
      segments.colors[ci]!,
      segments.colors[ci + 1]!,
      segments.colors[ci + 2]!,
      segments.colors[ci + 3]!,
    )
    content += `<line x1="${segments.x1s[i]}" y1="${segments.y1s[i]}" x2="${segments.x2s[i]}" y2="${segments.y2s[i]}" stroke="${color}" stroke-width="2"/>`
  }

  return (
    <g
      transform={`translate(0,${viewHeight}) scale(${scaleX},-${scaleY}) translate(${-offX},${-offY})`}
    >
      <g dangerouslySetInnerHTML={{ __html: content }} />
    </g>
  )
}
