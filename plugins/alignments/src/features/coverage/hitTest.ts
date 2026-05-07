import type { CoverageHitResult } from './types.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'

// Find the first significant position in [binStart, binEnd). "Significant"
// = at least `threshold` fraction of reads at that position, relative to
// the local coverage depth. Single pass + small Map keyed by uint32 position.
function findSignificantInBin(
  positions: Uint32Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
  binStart: number,
  binEnd: number,
  threshold: number,
) {
  const hitsByPos = new Map<number, number>()
  for (const pos of positions) {
    if (pos >= binStart && pos < binEnd) {
      hitsByPos.set(pos, (hitsByPos.get(pos) ?? 0) + 1)
    }
  }
  let best = -1
  for (const [pos, n] of hitsByPos) {
    const binIdx = Math.floor(pos - coverageStartPos)
    const depth = coverageDepths[binIdx]
    if (depth && n / depth > threshold && (best < 0 || pos < best)) {
      best = pos
    }
  }
  return best < 0 ? undefined : best
}

export function hitTestCoverage(
  genomicPos: number,
  bpPerPx: number,
  canvasY: number,
  rpcData: PileupDataResult,
  showCoverage: boolean,
  coverageHeight: number,
): CoverageHitResult | undefined {
  if (!showCoverage || canvasY > coverageHeight) {
    return undefined
  }

  const { coverageDepths, coverageStartPos } = rpcData
  const binIndex = Math.floor(genomicPos - coverageStartPos)
  if (binIndex < 0 || binIndex >= coverageDepths.length) {
    return undefined
  }

  const binStart = coverageStartPos + binIndex
  if (bpPerPx > 1) {
    const binEnd = binStart + Math.ceil(bpPerPx)
    const snpHit = findSignificantInBin(
      rpcData.mismatchPositions,
      coverageDepths,
      coverageStartPos,
      binStart,
      binEnd,
      0.05,
    )
    if (snpHit !== undefined) {
      return { type: 'coverage', position: snpHit }
    }
    const noncovHit = findSignificantInBin(
      rpcData.interbasePositions,
      coverageDepths,
      coverageStartPos,
      binStart,
      binEnd,
      0.2,
    )
    if (noncovHit !== undefined) {
      return { type: 'coverage', position: noncovHit }
    }
  }

  return { type: 'coverage', position: binStart }
}
