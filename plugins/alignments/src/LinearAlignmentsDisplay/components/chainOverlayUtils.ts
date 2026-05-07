import type { RenderState } from './rendererTypes.ts'

export interface ClipRect {
  sx1: number
  sx2: number
  syTop: number
  syBot: number
}

// Minimal read-position shape `getChainBounds` needs. Both Canvas2DRegionData
// (extends ReadRegionFields) and the GPU renderer's LocalRegion satisfy this
// structurally — getChainBounds is the only consumer.
export interface ChainBoundsRegion {
  readIdToIndex: Map<string, number>
  readPositions: Uint32Array
  readYs: Uint16Array
}

export function getChainBounds(ids: string[], region: ChainBoundsRegion) {
  const { readIdToIndex, readPositions, readYs } = region
  let minStart = Infinity
  let maxEnd = -Infinity
  let y = 0
  for (const id of ids) {
    const idx = readIdToIndex.get(id)
    if (idx === undefined) {
      continue
    }
    const s = readPositions[idx * 2]
    const e = readPositions[idx * 2 + 1]
    const row = readYs[idx]
    if (s !== undefined && s < minStart) {
      minStart = s
    }
    if (e !== undefined && e > maxEnd) {
      maxEnd = e
    }
    if (row !== undefined) {
      y = row
    }
  }
  return minStart < Infinity ? { minStart, maxEnd, y } : undefined
}

export function toClipRect(
  absStart: number,
  absEnd: number,
  y: number,
  state: RenderState,
  bpStart: number,
  regionLengthBp: number,
  coverageOffset: number,
  canvasHeight: number,
  reversed = false,
): ClipRect {
  // JS numbers are float64 — full precision at genomic scale, no hp-split
  // needed (unlike the GPU shader which is float32).
  const bpToClipX = (bp: number) =>
    ((Math.floor(bp) - bpStart) / regionLengthBp) * 2 - 1
  const rawSx1 = bpToClipX(absStart)
  const rawSx2 = bpToClipX(absEnd)
  const sx1 = reversed ? -rawSx2 : rawSx1
  const sx2 = reversed ? -rawSx1 : rawSx2

  const rowHeight = state.featureHeight + state.featureSpacing
  const yTopPx = y * rowHeight - state.rangeY[0]
  const yBotPx = yTopPx + state.featureHeight
  const pileupTop = 1 - (coverageOffset / canvasHeight) * 2
  const pxToClip = 2 / canvasHeight
  const syTop = pileupTop - yTopPx * pxToClip
  const syBot = pileupTop - yBotPx * pxToClip

  return { sx1, sx2, syTop, syBot }
}
