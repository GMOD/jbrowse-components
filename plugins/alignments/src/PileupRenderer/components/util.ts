import type { Region } from '@jbrowse/core/util'

export function makeRect(
  r: [number, number, number, number] | [number, number, number, number, any],
  offset: number,
  region: Region,
  bpPerPx: number,
) {
  const [leftBp, topPx, rightBp, bottomPx] = r
  const leftPx = region.reversed
    ? (region.end - rightBp) / bpPerPx
    : (leftBp - region.start) / bpPerPx
  const rightPx = region.reversed
    ? (region.end - leftBp) / bpPerPx
    : (rightBp - region.start) / bpPerPx
  const rectTop = Math.round(topPx)
  const rectHeight = Math.round(bottomPx - topPx)
  return {
    left: leftPx - offset,
    top: rectTop - offset,
    width: rightPx - leftPx,
    height: rectHeight,
  }
}
