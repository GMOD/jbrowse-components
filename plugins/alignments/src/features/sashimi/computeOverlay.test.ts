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
  mode: 'up',
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

test('wider junctions get taller arcs (span-scaled nesting)', () => {
  // Three junctions of increasing span share a start at bp 100.
  const data = {
    sashimiX1: new Uint32Array([100, 100, 100]),
    sashimiX2: new Uint32Array([150, 300, 1100]),
    sashimiCounts: new Uint32Array([5, 5, 5]),
    sashimiColorTypes: new Uint8Array([0, 0, 0]),
  } as unknown as PileupDataResult
  const arcs = computeSashimiArcs(baseOpts(data, 0))
  // up-mode: a taller arc rises further, so its apex labelY is smaller.
  expect(arcs[0]!.labelY).toBeGreaterThan(arcs[1]!.labelY)
  expect(arcs[1]!.labelY).toBeGreaterThan(arcs[2]!.labelY)
})

test('suppresses the count label on sub-pixel-narrow junctions', () => {
  const data = {
    sashimiX1: new Uint32Array([100, 100]),
    sashimiX2: new Uint32Array([105, 400]),
    sashimiCounts: new Uint32Array([5, 5]),
    sashimiColorTypes: new Uint8Array([0, 0]),
  } as unknown as PileupDataResult
  const arcs = computeSashimiArcs(baseOpts(data, 0))
  expect(arcs[0]!.showLabel).toBe(false)
  expect(arcs[1]!.showLabel).toBe(true)
})

test('up/down modes force every arc to one side', () => {
  const data = makeData([5, 5, 5])
  const up = computeSashimiArcs({ ...baseOpts(data, 0), mode: 'up' })
  const down = computeSashimiArcs({ ...baseOpts(data, 0), mode: 'down' })
  expect(up.every(a => a.side === 'up')).toBe(true)
  expect(down.every(a => a.side === 'down')).toBe(true)
})

test('auto splits crossing junctions onto opposite sides', () => {
  // Two interleaving junctions (100-300 and 200-400) cross, so auto pulls them
  // apart; a disjoint third (500-600) can share a side.
  const data = {
    sashimiX1: new Uint32Array([100, 200, 500]),
    sashimiX2: new Uint32Array([300, 400, 600]),
    sashimiCounts: new Uint32Array([5, 5, 5]),
    sashimiColorTypes: new Uint8Array([0, 0, 0]),
  } as unknown as PileupDataResult
  const arcs = computeSashimiArcs({ ...baseOpts(data, 0), mode: 'auto' })
  const byStart = new Map(arcs.map(a => [a.start, a.side]))
  expect(byStart.get(100)).not.toBe(byStart.get(200))
})

test('auto puts the heavier of two crossing junctions on the upper band', () => {
  // 100-300 (light) and 200-400 (heavy) cross; the heavier claims 'up'.
  const data = {
    sashimiX1: new Uint32Array([100, 200]),
    sashimiX2: new Uint32Array([300, 400]),
    sashimiCounts: new Uint32Array([5, 50]),
    sashimiColorTypes: new Uint8Array([0, 0]),
  } as unknown as PileupDataResult
  const arcs = computeSashimiArcs({ ...baseOpts(data, 0), mode: 'auto' })
  const byStart = new Map(arcs.map(a => [a.start, a.side]))
  expect(byStart.get(200)).toBe('up')
  expect(byStart.get(100)).toBe('down')
})
