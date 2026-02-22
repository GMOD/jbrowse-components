import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
} from './wiggleShader.ts'

import type { WiggleGPURenderState } from './WiggleRenderer.ts'

export function getRowHeight(canvasHeight: number, numRows: number) {
  return numRows > 0 ? canvasHeight / numRows : canvasHeight
}

export function getRowTop(rowIndex: number, rowHeight: number) {
  return rowIndex * rowHeight
}

const renderingTypeMap: Record<string, number> = {
  density: RENDERING_TYPE_DENSITY,
  multirowdensity: RENDERING_TYPE_DENSITY,
  line: RENDERING_TYPE_LINE,
  multirowline: RENDERING_TYPE_LINE,
  scatter: RENDERING_TYPE_SCATTER,
  multirowscatter: RENDERING_TYPE_SCATTER,
}

export function renderingTypeToInt(type: string) {
  return renderingTypeMap[type] ?? RENDERING_TYPE_XYPLOT
}

export function makeRenderState(
  domain: [number, number],
  scaleType: string,
  renderingType: string,
  width: number,
  height: number,
): WiggleGPURenderState {
  return {
    domainY: domain,
    scaleType: scaleType === 'log' ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR,
    renderingType: renderingTypeToInt(renderingType),
    canvasWidth: width,
    canvasHeight: height,
  }
}
