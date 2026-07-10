import { abgrBlue, abgrRed, packAbgr } from '@jbrowse/core/util/colorBits'

import { computeModificationCoverage } from './compute.ts'

import type { StrandBaseCounts } from '../../shared/calculateModificationCounts.ts'
import type { ModificationEntry } from '../../shared/webglRpcTypes.ts'

// One C position, 10 forward C reads → modifiable C count = 10 (read-base
// pileup, the IGV-style denominator, computed upstream by computeReadBaseCounts).
const POS = 10
const coverage = {
  depths: new Float32Array(20).fill(0),
  maxDepth: 10,
  startPos: 0,
}
coverage.depths[POS] = 10
const baseCounts = new Map<number, StrandBaseCounts>([
  [POS, { C: { fwd: 10, rev: 0 } }],
])

function modEntry(over: Partial<ModificationEntry>): ModificationEntry {
  return {
    readIndex: 0,
    position: POS,
    base: 'C',
    modType: 'm',
    strand: 1,
    color: packAbgr(0, 0, 0, 255),
    prob: 1,
    noMod: false,
    ...over,
  }
}

const red = modEntry({ color: packAbgr(255, 0, 0, 255), prob: 1, noMod: false })
const blue = modEntry({
  color: packAbgr(0, 0, 255, 255),
  prob: 0.8,
  noMod: true,
})

function run(mods: ModificationEntry[]) {
  return computeModificationCoverage(mods, baseCounts, 0, coverage, new Set())
}

test('5mC (red) always stacks below unmodified (blue) regardless of input order', () => {
  for (const mods of [
    [red, blue],
    [blue, red],
  ]) {
    const out = run(mods)
    expect(out.count).toBe(2)
    // bottom segment (yOffset 0) is red; top segment is blue
    expect(out.yOffsets[0]).toBe(0)
    expect(out.yOffsets[1]).toBeGreaterThan(0)
    expect(abgrRed(out.colors[0]!)).toBe(255)
    expect(abgrBlue(out.colors[1]!)).toBe(255)
  }
})

test('two mod types sharing an RGB stay separate segments (keyed by type, not color)', () => {
  // e.g. two numeric ChEBI codes that hash to the same color. Keying by color
  // alone would merge them into one bar; they must remain two stacked segments.
  const a = modEntry({ modType: '16061', color: packAbgr(100, 100, 100, 255) })
  const b = modEntry({ modType: '76792', color: packAbgr(100, 100, 100, 255) })
  const out = run([a, b])
  expect(out.count).toBe(2)
})

test('bar height is a read count, not a probability-weighted sum', () => {
  // single red read at prob 0.5: height must be (modifiable/depth)*(count/detectable)
  // = (10/10)*(1/10) = 0.1, NOT weighted down to 0.05 by the 0.5 probability.
  const out = run([modEntry({ color: packAbgr(255, 0, 0, 255), prob: 0.5 })])
  expect(out.heights[0]).toBeCloseTo(0.1)
})

test('simplex modification uses a reduced (examined-strand) denominator', () => {
  // Reads at POS split across strands for the C (base) and G (complement):
  //   modifiable = C.fwd+C.rev + G.fwd+G.rev = 8 + 7 = 15
  //   simplex detectable = C.fwd(6) + G.rev(4) = 10 (only the basecalled strand)
  //   duplex detectable = modifiable = 15
  // With depth 15 and 5 above-threshold 'm' calls, height =
  //   (modifiable/depth) * (count/detectable) = (15/15) * (5/detectable).
  const depthCoverage = {
    depths: new Float32Array(20).fill(0),
    maxDepth: 15,
    startPos: 0,
  }
  depthCoverage.depths[POS] = 15
  const strandSplitCounts = new Map<number, StrandBaseCounts>([
    [POS, { C: { fwd: 6, rev: 2 }, G: { fwd: 3, rev: 4 } }],
  ])
  const mods = Array.from({ length: 5 }, () => modEntry({}))

  const simplex = computeModificationCoverage(
    mods,
    strandSplitCounts,
    0,
    depthCoverage,
    new Set(['m']),
  )
  const duplex = computeModificationCoverage(
    mods,
    strandSplitCounts,
    0,
    depthCoverage,
    new Set(),
  )
  expect(simplex.heights[0]).toBeCloseTo(0.5) // 5/10
  expect(duplex.heights[0]).toBeCloseTo(1 / 3) // 5/15
})
