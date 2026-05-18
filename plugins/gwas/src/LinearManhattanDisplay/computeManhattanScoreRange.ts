import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'

// Reduces per-region score stats into a single [min, max] range. Returns
// undefined when no region has any features (so the autoscale domain stays
// in a "loading" state instead of showing a degenerate [Infinity, -Infinity]).
export function computeManhattanScoreRange(
  perRegion: Iterable<ManhattanRpcResult>,
): [number, number] | undefined {
  let scoreMin = Infinity
  let scoreMax = -Infinity
  let saw = false
  for (const d of perRegion) {
    if (d.numFeatures === 0) {
      continue
    }
    saw = true
    if (d.scoreMin < scoreMin) {
      scoreMin = d.scoreMin
    }
    if (d.scoreMax > scoreMax) {
      scoreMax = d.scoreMax
    }
  }
  return saw ? [scoreMin, scoreMax] : undefined
}
