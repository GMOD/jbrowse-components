import {
  colorFwdStrand,
  colorNostrand,
  colorRevStrand,
} from '@jbrowse/core/ui/theme'

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

test('suppresses the count label when the digits, not the span, overflow', () => {
  // Same 30px span, different counts. A flat span threshold showed both; a
  // 5-digit count needs ~36px of text and has to stay suppressed.
  const data = {
    sashimiX1: new Uint32Array([100, 500]),
    sashimiX2: new Uint32Array([130, 530]),
    sashimiCounts: new Uint32Array([5, 12345]),
    sashimiColorTypes: new Uint8Array([0, 0]),
  } as unknown as PileupDataResult
  const arcs = computeSashimiArcs(baseOpts(data, 0))
  const showByStart = new Map(arcs.map(a => [a.start, a.showLabel]))
  expect(showByStart.get(100)).toBe(true)
  expect(showByStart.get(500)).toBe(false)
})

test('auto splits crossing junctions in a reversed displayed region', () => {
  // A reversed region projects a junction's start to the LARGER screen x, so the
  // raw left/right come back flipped. The same crossing pair as the forward-
  // strand test above must still split — before the screen-order normalization,
  // `crosses` read the flipped pair as non-interleaving and left both on 'up'.
  const data = {
    sashimiX1: new Uint32Array([100, 200]),
    sashimiX2: new Uint32Array([300, 400]),
    sashimiCounts: new Uint32Array([5, 5]),
    sashimiColorTypes: new Uint8Array([0, 0]),
  } as unknown as PileupDataResult
  const arcs = computeSashimiArcs({
    ...baseOpts(data, 0),
    mode: 'auto',
    bpToScreenX: (_refName: string, bp: number) => 1000 - bp,
  })
  const byStart = new Map(arcs.map(a => [a.start, a.side]))
  expect(byStart.get(100)).not.toBe(byStart.get(200))
})

test('tints arcs with the read-alignment strand colors', () => {
  // colorType 0/1/2 -> strand fwd/rev/unknown; each arc reuses the matching
  // read strand color so a junction reads the same hue as its supporting reads.
  const data = {
    sashimiX1: new Uint32Array([100, 300, 500]),
    sashimiX2: new Uint32Array([200, 400, 600]),
    sashimiCounts: new Uint32Array([5, 5, 5]),
    sashimiColorTypes: new Uint8Array([0, 1, 2]),
  } as unknown as PileupDataResult
  const arcs = computeSashimiArcs(baseOpts(data, 0))
  const strokeByStart = new Map(arcs.map(a => [a.start, a.stroke]))
  expect(strokeByStart.get(100)).toBe(colorFwdStrand)
  expect(strokeByStart.get(300)).toBe(colorRevStrand)
  expect(strokeByStart.get(500)).toBe(colorNostrand)
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

test('dedupes a junction shared across same-refName regions (collapsed introns)', () => {
  // Collapsed introns split one refName into many displayedRegions (exons). A
  // junction spanning exon A -> exon B is a skip-gap in reads that overlap BOTH
  // regions, so both per-region fetches return them and the worker emits the
  // same absolute junction in each region's rpcData. Real counts are identical
  // (the fetch is uncapped); the 5-vs-8 here is synthetic to prove the merge
  // collapses to one arc and keeps the higher count, rather than rendering two
  // arcs that share an identical refName:start:end:strand React key.
  const region0 = {
    sashimiX1: new Uint32Array([100]),
    sashimiX2: new Uint32Array([1100]),
    sashimiCounts: new Uint32Array([5]),
    sashimiColorTypes: new Uint8Array([0]),
  } as unknown as PileupDataResult
  const region1 = {
    sashimiX1: new Uint32Array([100]),
    sashimiX2: new Uint32Array([1100]),
    sashimiCounts: new Uint32Array([8]),
    sashimiColorTypes: new Uint8Array([0]),
  } as unknown as PileupDataResult
  const arcs = computeSashimiArcs({
    rpcDataMap: new Map([
      [0, region0],
      [1, region1],
    ]),
    visibleRegions: [
      { refName: 'chr1', displayedRegionIndex: 0 },
      { refName: 'chr1', displayedRegionIndex: 1 },
    ],
    bpToScreenX: (_refName: string, bp: number) => bp,
    coverageHeight: 100,
    sashimiArcsHeight: 40,
    mode: 'up',
    minSashimiScore: 0,
  })
  expect(arcs).toHaveLength(1)
  expect(arcs[0]!.score).toBe(8)
})

test('auto keeps shared-start (nested) junctions on the same side', () => {
  // Same donor, two acceptors (100-300, 100-500) — common in alternative
  // splicing. These nest concentrically rather than interleave, so auto must
  // NOT split them across bands the way it does for a true crossing.
  const data = {
    sashimiX1: new Uint32Array([100, 100]),
    sashimiX2: new Uint32Array([300, 500]),
    sashimiCounts: new Uint32Array([5, 5]),
    sashimiColorTypes: new Uint8Array([0, 0]),
  } as unknown as PileupDataResult
  const arcs = computeSashimiArcs({ ...baseOpts(data, 0), mode: 'auto' })
  expect(arcs.every(a => a.side === 'up')).toBe(true)
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
