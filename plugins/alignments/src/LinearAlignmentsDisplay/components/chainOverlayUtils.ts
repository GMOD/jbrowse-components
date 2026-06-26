import type { RenderState } from '../renderers/rendererTypes.ts'

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
  let startBp = Infinity
  let endBp = -Infinity
  // All reads in a chain share one row (computeChainLayout), so any read's row
  // is the chain's row.
  let yRow = 0
  for (const id of ids) {
    const idx = readIdToIndex.get(id)
    if (idx === undefined) {
      continue
    }
    const s = readPositions[idx * 2]
    const e = readPositions[idx * 2 + 1]
    const row = readYs[idx]
    if (s !== undefined && s < startBp) {
      startBp = s
    }
    if (e !== undefined && e > endBp) {
      endBp = e
    }
    if (row !== undefined) {
      yRow = row
    }
  }
  return startBp < Infinity ? { startBp, endBp, yRow } : undefined
}

// Bounds of the current selection, or undefined when nothing is selected (or the
// selection isn't in this region). A chain selection supersedes a single-read
// selection — the chain bounds already cover the read. Both renderers share this
// decision so they can't drift on selection priority; only the paint differs
// (the GPU pushes a selection-frame quad, Canvas2D strokes a box).
export function getSelectionBounds(
  state: RenderState,
  region: ChainBoundsRegion,
) {
  let result: { startBp: number; endBp: number; yRow: number } | undefined
  if (state.selectedChainIds.length > 0) {
    result = getChainBounds(state.selectedChainIds, region)
  } else if (state.selectedFeatureId) {
    const idx = region.readIdToIndex.get(state.selectedFeatureId)
    if (idx !== undefined && idx < region.readYs.length) {
      result = {
        startBp: region.readPositions[idx * 2]!,
        endBp: region.readPositions[idx * 2 + 1]!,
        yRow: region.readYs[idx]!,
      }
    }
  }
  return result
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
  const yTopPx = y * rowHeight - state.scrollTop
  const yBotPx = yTopPx + state.featureHeight
  const pileupTop = 1 - (coverageOffset / canvasHeight) * 2
  const pxToClip = 2 / canvasHeight
  const syTop = pileupTop - yTopPx * pxToClip
  const syBot = pileupTop - yBotPx * pxToClip

  return { sx1, sx2, syTop, syBot }
}
