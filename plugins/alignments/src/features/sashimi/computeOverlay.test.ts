import { computeSashimiArcs } from './computeOverlay.ts'

import type { ComputeSashimiArcsOpts } from './computeOverlay.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// Minimal PileupDataResult with only the sashimi fields computeSashimiArcs reads.
function makeData(counts: number[]): PileupDataResult {
  const n = counts.length
  const sashimiX1 = new Uint32Array(n)
  const sashimiX2 = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    sashimiX1[i] = 100 + i * 100
    sashimiX2[i] = 200 + i * 100
  }
  return {
    sashimiX1,
    sashimiX2,
    sashimiCounts: new Uint32Array(counts),
    sashimiColorTypes: new Uint8Array(n),
    sashimiScores: new Float32Array(counts.map(c => Math.log(c + 1))),
  } as unknown as PileupDataResult
}

const baseOpts = (
  rpcData: PileupDataResult,
  minSashimiScore: number,
): ComputeSashimiArcsOpts => ({
  rpcDataMap: new Map([[0, rpcData]]),
  visibleRegions: [{ refName: 'chr1', displayedRegionIndex: 0 }],
  bpToScreenX: (_refName: string, bp: number) => bp,
  coverageHeight: 100,
  sashimiArcsHeight: 40,
  sashimiArcsDown: false,
  minSashimiScore,
})

test('shows all arcs when minSashimiScore is 0', () => {
  const arcs = computeSashimiArcs(baseOpts(makeData([1, 5, 10]), 0))
  expect(arcs.map(a => a.score)).toEqual([1, 5, 10])
})

test('filters arcs below minSashimiScore', () => {
  const arcs = computeSashimiArcs(baseOpts(makeData([1, 5, 10]), 5))
  expect(arcs.map(a => a.score)).toEqual([5, 10])
})

test('keeps arcs whose count equals minSashimiScore (>= boundary)', () => {
  const arcs = computeSashimiArcs(baseOpts(makeData([4, 5]), 5))
  expect(arcs.map(a => a.score)).toEqual([5])
})

test('drops every arc when threshold exceeds all counts', () => {
  const arcs = computeSashimiArcs(baseOpts(makeData([1, 2, 3]), 100))
  expect(arcs).toHaveLength(0)
})
