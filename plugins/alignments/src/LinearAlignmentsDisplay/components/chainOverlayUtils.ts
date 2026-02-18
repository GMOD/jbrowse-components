import type { RenderState } from './WebGLRenderer.ts'

export interface ClipRect {
  sx1: number
  sx2: number
  syTop: number
  syBot: number
}

export function getChainBounds(
  indices: number[],
  readPositions: Uint32Array,
  readYs: Uint16Array,
) {
  let minStart = Infinity
  let maxEnd = -Infinity
  let y = 0
  for (const idx of indices) {
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
  bpStartHi: number,
  bpStartLo: number,
  regionLengthBp: number,
  coverageOffset: number,
  canvasHeight: number,
): ClipRect {
  const splitStart0 = Math.floor(absStart) - (Math.floor(absStart) & 0xfff)
  const splitStart1 = Math.floor(absStart) & 0xfff
  const splitEnd0 = Math.floor(absEnd) - (Math.floor(absEnd) & 0xfff)
  const splitEnd1 = Math.floor(absEnd) & 0xfff
  const sx1 =
    ((splitStart0 - bpStartHi + splitStart1 - bpStartLo) / regionLengthBp) *
      2 -
    1
  const sx2 =
    ((splitEnd0 - bpStartHi + splitEnd1 - bpStartLo) / regionLengthBp) * 2 - 1

  const rowHeight = state.featureHeight + state.featureSpacing
  const yTopPx = y * rowHeight - state.rangeY[0]
  const yBotPx = yTopPx + state.featureHeight
  const pileupTop = 1 - (coverageOffset / canvasHeight) * 2
  const pxToClip = 2 / canvasHeight
  const syTop = pileupTop - yTopPx * pxToClip
  const syBot = pileupTop - yBotPx * pxToClip

  return { sx1, sx2, syTop, syBot }
}
