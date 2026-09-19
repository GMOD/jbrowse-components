// Geometry and vocabulary the wiggle display components share: where a row
// sits, what a rendering-type name means, and the render state handed to the
// backend each frame. Layer building lives in wiggleLayers.ts and hit testing
// in wiggleHitTest.ts.
import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
  resolveRenderState,
  resolveSymlogConstant,
} from '@jbrowse/wiggle-core'

import type {
  WiggleGPURenderState,
  WiggleRenderingType,
} from '@jbrowse/wiggle-core'

// The rendering-mode vocabulary lives in `@jbrowse/wiggle-core`, next to the
// `WiggleRenderingType` union it inhabits, and is wiggle.slang's own numbering
// generated in (adr-051). Import it from there, not through this module.

export function getRowHeight(canvasHeight: number, numRows: number) {
  return numRows > 0 ? canvasHeight / numRows : canvasHeight
}

export function getRowTop(rowIndex: number, rowHeight: number) {
  return rowIndex * rowHeight
}

// The interpolated line's break rule, shared by its line and band on both
// backends.
export function centerLinksToPrevious(
  positions: Uint32Array,
  i: number,
  gapLimitBp: number,
) {
  return (
    i > 0 &&
    (positions[i * 2]! + positions[i * 2 + 1]!) / 2 -
      (positions[i * 2 - 2]! + positions[i * 2 - 1]!) / 2 <=
      gapLimitBp
  )
}

export function isScatterMode(renderingType: string) {
  return renderingTypeToInt(renderingType) === RENDERING_TYPE_SCATTER
}

// Both line renderings — the stepped bar-tops and the interpolated
// point-to-point one — since they are exactly the ones `lineWidth` applies to.
export function isLineMode(renderingType: string) {
  const type = renderingTypeToInt(renderingType)
  return type === RENDERING_TYPE_LINE || type === RENDERING_TYPE_LINE_CENTER
}

const renderingTypeMap: Record<string, WiggleRenderingType> = {
  xyplot: RENDERING_TYPE_XYPLOT,
  density: RENDERING_TYPE_DENSITY,
  line: RENDERING_TYPE_LINE,
  linecenter: RENDERING_TYPE_LINE_CENTER,
  scatter: RENDERING_TYPE_SCATTER,
}

export function renderingTypeToInt(type: string): WiggleRenderingType {
  const result = renderingTypeMap[type]
  if (result === undefined) {
    throw new Error(`Unknown wiggle rendering type: ${type}`)
  }
  return result
}

// Everything in a wiggle-family render state except the canvas box comes off
// the model, so the two displays supply only what genuinely differs: single
// wiggle insets by the scalebar label gutter and draws one row, multi stacks
// rows edge-to-edge over the full height.
export interface WiggleRenderStateModel {
  domain: [number, number] | undefined
  scaleType: string
  symlogConstant: number
  renderingType: string
  scatterPointSize: number
  lineWidth: number
  bicolorPivot: number
  densityColorRamp: string
}

// Always defined: until autoscale resolves a domain, resolveRenderState
// substitutes a [0,1] stub so an uncovered region still renders (clears the
// canvas, flips canvasDrawn, instead of spinning forever). "Still loading" is
// expressed separately by the boolean `renderBlocks` returns.
export function makeWiggleRenderState(
  self: WiggleRenderStateModel,
  {
    width,
    height,
    numRows,
  }: { width: number; height: number; numRows: number },
): WiggleGPURenderState {
  return resolveRenderState(self.domain, domainY => ({
    domainY,
    scaleType: scaleTypeCode(self.scaleType),
    symlogConstant: resolveSymlogConstant(
      domainY[0],
      domainY[1],
      self.symlogConstant,
    ),
    renderingType: renderingTypeToInt(self.renderingType),
    canvasWidth: width,
    canvasHeight: height,
    // Floored at 1: a source list that filters to empty (a subtree filter
    // naming nothing present) leaves numRows 0. Nothing is encoded for that
    // state any more, but the shader's bare `canvasHeight / numRows` divides
    // regardless of instance count and would seed the row transform with
    // Infinity. Flooring here is the one place both backends read.
    numRows: Math.max(1, numRows),
    scatterPointSize: self.scatterPointSize,
    lineWidth: self.lineWidth,
    // bars pivot around, and density fades from, the bicolor threshold
    origin: self.bicolorPivot,
    densityColorRamp: self.densityColorRamp,
  }))
}
