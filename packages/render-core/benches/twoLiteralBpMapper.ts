import type { BpRegionBounds } from '../src/renderBlock.ts'

function pxPerBpOf(bounds: BpRegionBounds) {
  return (
    (bounds.screenEndPx - bounds.screenStartPx) / (bounds.end - bounds.start)
  )
}

export function makeBpMapperOld(bounds: BpRegionBounds) {
  const { start, end, screenStartPx, screenEndPx, reversed } = bounds
  const span = end - start
  const w = screenEndPx - screenStartPx
  return reversed
    ? (bp: number) => screenEndPx - ((bp - start) / span) * w
    : (bp: number) => screenStartPx + ((bp - start) / span) * w
}

export function makeCellLeftMapperOld(bounds: BpRegionBounds) {
  const toX = makeBpMapperOld(bounds)
  const pxPerBp = pxPerBpOf(bounds)
  const shift = bounds.reversed ? -pxPerBp : 0
  return (bp: number) => toX(bp) + shift
}

export function makeBpMapperControl(bounds: BpRegionBounds) {
  const { start, end, screenStartPx, screenEndPx, reversed } = bounds
  const span = end - start
  const w = screenEndPx - screenStartPx
  return reversed
    ? (bp: number) => screenEndPx - ((bp - start) / span) * w
    : (bp: number) => screenStartPx + ((bp - start) / span) * w
}

export function makeCellLeftMapperControl(bounds: BpRegionBounds) {
  const toX = makeBpMapperControl(bounds)
  const pxPerBp = pxPerBpOf(bounds)
  const shift = bounds.reversed ? -pxPerBp : 0
  return (bp: number) => toX(bp) + shift
}
