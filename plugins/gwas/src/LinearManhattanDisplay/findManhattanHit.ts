import { bpToScreenPx } from '@jbrowse/core/gpu/canvas2dUtils'
import Flatbush from '@jbrowse/core/util/flatbush'

import type { ManhattanRenderState } from './manhattanBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export interface ManhattanHit {
  refName: string
  start: number
  end: number
  score: number
  screenX: number
  screenY: number
}

const HIT_RADIUS_PX = 8

// Caches the Flatbush instance per ArrayBuffer so we don't rebuild the
// wrapper (and its FlatQueue) on every mousemove. The cache is weak so it
// drops automatically when a region's data is replaced or evicted.
const flatbushCache = new WeakMap<ArrayBuffer, Flatbush>()
function getFlatbush(buffer: ArrayBuffer): Flatbush {
  let fb = flatbushCache.get(buffer)
  if (!fb) {
    fb = Flatbush.from(buffer)
    flatbushCache.set(buffer, fb)
  }
  return fb
}

// 2D hit test. The Flatbush index over (bp, score) is built worker-side per
// region; here we derive an (bp, score) query box from the mouse position +
// current view and only check exact pixel distance for points inside that
// box. Falls back to a linear scan when the worker emitted no index (legacy
// data path; should not happen in practice).
export function findManhattanHit(
  mouseX: number,
  mouseY: number,
  blocks: RenderBlock[],
  regionData: ReadonlyMap<number, ManhattanRpcResult>,
  state: ManhattanRenderState,
  refNames: Map<number, string>,
): ManhattanHit | undefined {
  const { domainY, canvasHeight } = state
  const [domainMin, domainMax] = domainY
  const range = domainMax - domainMin || 1

  let bestDistSq = HIT_RADIUS_PX * HIT_RADIUS_PX
  let best: ManhattanHit | undefined

  for (const block of blocks) {
    const data = regionData.get(block.displayedRegionIndex)
    const refName = refNames.get(block.displayedRegionIndex)
    if (!data || !refName || data.numFeatures === 0) {
      continue
    }
    const [bpStart, bpEnd] = block.bpRangeX
    const { screenStartPx, screenEndPx, reversed } = block
    const blockWidthPx = screenEndPx - screenStartPx
    if (blockWidthPx <= 0) {
      continue
    }
    const bpPerPx = (bpEnd - bpStart) / blockWidthPx
    const mouseBp = reversed
      ? bpStart + (screenEndPx - mouseX) * bpPerPx
      : bpStart + (mouseX - screenStartPx) * bpPerPx
    const halfBp = HIT_RADIUS_PX * bpPerPx
    const candBpMin = mouseBp - halfBp
    const candBpMax = mouseBp + halfBp
    if (candBpMax < bpStart || candBpMin > bpEnd) {
      continue
    }

    // Convert mouseY back into a score-space query window. Expand to ±Infinity
    // when the mouse is at the canvas edge so clamped (out-of-domain) features
    // visually pinned to the edge are still candidates.
    const halfScore = HIT_RADIUS_PX * (range / canvasHeight)
    const mouseScore = domainMax - (mouseY / canvasHeight) * range
    const candScoreMin =
      mouseY >= canvasHeight - HIT_RADIUS_PX
        ? -Infinity
        : mouseScore - halfScore
    const candScoreMax =
      mouseY <= HIT_RADIUS_PX ? Infinity : mouseScore + halfScore

    const { positions, scores, numFeatures, flatbushData } = data
    const candidates = flatbushData
      ? getFlatbush(flatbushData).search(
          candBpMin,
          candScoreMin,
          candBpMax,
          candScoreMax,
        )
      : linearCandidates(positions, numFeatures, candBpMin, candBpMax)

    for (const i of candidates) {
      const pos = positions[i]!
      const score = scores[i]!
      const ptX = bpToScreenPx(
        pos,
        bpStart,
        bpEnd,
        screenStartPx,
        screenEndPx,
        reversed,
      )
      const norm = Math.max(0, Math.min(1, (score - domainMin) / range))
      const ptY = (1 - norm) * canvasHeight
      const dx = mouseX - ptX
      const dy = mouseY - ptY
      const distSq = dx * dx + dy * dy
      if (distSq < bestDistSq) {
        bestDistSq = distSq
        best = {
          refName,
          start: pos,
          end: pos + 1,
          score,
          screenX: ptX,
          screenY: ptY,
        }
      }
    }
  }

  return best
}

// Fallback for results that lack a flatbush index (e.g. legacy fixtures in
// tests). Sorted-positions binary search bounds candidates by bp window.
function linearCandidates(
  positions: Uint32Array,
  numFeatures: number,
  candBpMin: number,
  candBpMax: number,
): number[] {
  let lo = 0
  let hi = numFeatures
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (positions[mid]! < candBpMin) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  const out: number[] = []
  for (let i = lo; i < numFeatures; i++) {
    if (positions[i]! > candBpMax) {
      break
    }
    out.push(i)
  }
  return out
}
