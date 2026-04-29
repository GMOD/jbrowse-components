import type { CoverageHitResult } from './types.ts'
import type { ResolvedBlock } from '../../LinearAlignmentsDisplay/components/hitTesting.ts'

// Find the first significant position in [binStart, binEnd). "Significant"
// = at least `threshold` fraction of reads at that position, relative to
// the local coverage depth. Single pass + small Map keyed by uint32 position.
function findSignificantInBin(
  positions: Uint32Array,
  count: number,
  coverageDepths: Float32Array,
  coverageStartPos: number,
  binStart: number,
  binEnd: number,
  threshold: number,
) {
  const hitsByPos = new Map<number, number>()
  for (let i = 0; i < count; i++) {
    const pos = positions[i]!
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
  canvasX: number,
  canvasY: number,
  resolved: ResolvedBlock | undefined,
  showCoverage: boolean,
  coverageHeight: number,
): CoverageHitResult | undefined {
  if (!showCoverage || canvasY > coverageHeight || !resolved) {
    return undefined
  }

  const blockData = resolved.rpcData
  const { bpRange, blockStartPx, blockWidth, reversed } = resolved
  const bpPerPx = (bpRange[1] - bpRange[0]) / blockWidth
  const frac = (canvasX - blockStartPx) / blockWidth
  const genomicPos = reversed
    ? bpRange[1] - frac * (bpRange[1] - bpRange[0])
    : bpRange[0] + frac * (bpRange[1] - bpRange[0])

  const { coverageDepths, coverageStartPos } = blockData
  const binIndex = Math.floor(genomicPos - coverageStartPos)
  if (binIndex < 0 || binIndex >= coverageDepths.length) {
    return undefined
  }

  const binStart = coverageStartPos + binIndex
  if (bpPerPx > 1) {
    const binEnd = binStart + Math.ceil(bpPerPx)
    const snpHit = findSignificantInBin(
      blockData.mismatchPositions,
      blockData.mismatchPositions.length,
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
      blockData.interbasePositions,
      blockData.interbasePositions.length,
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
