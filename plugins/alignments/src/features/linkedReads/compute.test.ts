import {
  LINKED_READ_COLOR_PAIR_LL,
  LINKED_READ_COLOR_PAIR_LR,
  LINKED_READ_COLOR_PAIR_RL,
  LINKED_READ_COLOR_PAIR_RR,
  LINKED_READ_COLOR_SPLIT_INV,
  LINKED_READ_COLOR_SPLIT_NORMAL,
  classifyPair,
  computeLinkedReadLinesByRegion,
  connectionBp,
  filterEntries,
  groupReadsByName,
  isNormalOrientation,
} from './compute.ts'

import type { ReadEntry } from './compute.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'

const SAM_FLAG_PAIRED = 1
const SAM_FLAG_SECONDARY = 256
const SAM_FLAG_SUPPLEMENTARY = 2048
const SAM_FLAG_MATE_UNMAPPED = 8

// Minimal PileupDataResult with only the fields used by these functions.
function makeData(opts: {
  names: string[]
  flags: number[]
  strands: number[]
  positions: number[][]
  orientations: number[]
  ys: number[]
}): PileupDataResult {
  const n = opts.names.length
  const readPositions = new Uint32Array(n * 2)
  for (let i = 0; i < n; i++) {
    readPositions[i * 2] = opts.positions[i]![0]!
    readPositions[i * 2 + 1] = opts.positions[i]![1]!
  }
  return {
    readNames: opts.names,
    readIds: opts.names.map((_, i) => `id${i}`),
    readFlags: new Uint16Array(opts.flags),
    readStrands: new Int8Array(opts.strands),
    readPositions,
    readPairOrientations: new Uint8Array(opts.orientations),
    readYs: new Uint16Array(opts.ys),
  } as unknown as PileupDataResult
}

function makeEntry(
  data: PileupDataResult,
  readIdx: number,
  displayedRegionIndex = 0,
): ReadEntry {
  return { data, readIdx, displayedRegionIndex }
}

describe('connectionBp', () => {
  it('paired forward: 3-prime end', () => {
    expect(connectionBp(true, 1, 100, 200, false)).toBe(200)
  })

  it('paired reverse: 3-prime end (start)', () => {
    expect(connectionBp(true, -1, 100, 200, false)).toBe(100)
  })

  it('paired isSecond: same 3-prime formula for both reads', () => {
    expect(connectionBp(true, 1, 100, 200, true)).toBe(200)
    expect(connectionBp(true, -1, 100, 200, true)).toBe(100)
  })

  it('split first: always right (end) regardless of strand', () => {
    expect(connectionBp(false, 1, 100, 200, false)).toBe(200)
    expect(connectionBp(false, -1, 100, 200, false)).toBe(200)
  })

  it('split second: always left (start) regardless of strand', () => {
    expect(connectionBp(false, 1, 100, 200, true)).toBe(100)
    expect(connectionBp(false, -1, 100, 200, true)).toBe(100)
  })
})

describe('isNormalOrientation', () => {
  it('paired LR (orient 1) → normal', () => {
    expect(isNormalOrientation(true, 1, 1, -1)).toBe(true)
  })

  it('paired orient 0 → normal (degenerate)', () => {
    expect(isNormalOrientation(true, 0, 1, -1)).toBe(true)
  })

  it('paired RL (orient 2) → not normal', () => {
    expect(isNormalOrientation(true, 2, 1, -1)).toBe(false)
  })

  it('paired RR (orient 3) → not normal', () => {
    expect(isNormalOrientation(true, 3, 1, -1)).toBe(false)
  })

  it('paired LL (orient 4) → not normal', () => {
    expect(isNormalOrientation(true, 4, 1, -1)).toBe(false)
  })

  it('split FR (s1=1, p2Strand=-1) → normal', () => {
    expect(isNormalOrientation(false, 0, 1, -1)).toBe(true)
  })

  it('split RF (s1=-1, p2Strand=1) → normal (reverse-strand deletion)', () => {
    expect(isNormalOrientation(false, 0, -1, 1)).toBe(true)
  })

  it('split fwd+rev inversion (s1=1, p2Strand=1) → not normal', () => {
    expect(isNormalOrientation(false, 0, 1, 1)).toBe(false)
  })

  it('split rev+fwd inversion (s1=-1, p2Strand=-1) → not normal', () => {
    expect(isNormalOrientation(false, 0, -1, -1)).toBe(false)
  })
})

describe('classifyPair — paired reads', () => {
  function makePairedData(orient: number) {
    return makeData({
      names: ['r', 'r'],
      flags: [SAM_FLAG_PAIRED, SAM_FLAG_PAIRED],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      orientations: [orient, orient],
      ys: [0, 0],
    })
  }

  it('LR → PAIR_LR color, normal, 3-prime endpoints, hasPaired=true', () => {
    const data = makePairedData(1)
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1))
    expect(c.hasPaired).toBe(true)
    expect(c.colorType).toBe(LINKED_READ_COLOR_PAIR_LR)
    expect(c.isNormal).toBe(true)
    expect(c.bp1).toBe(200) // fwd 3-prime = end
    expect(c.bp2).toBe(300) // rev 3-prime = start
  })

  it('RL → PAIR_RL color, not normal', () => {
    const data = makePairedData(2)
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1))
    expect(c.hasPaired).toBe(true)
    expect(c.colorType).toBe(LINKED_READ_COLOR_PAIR_RL)
    expect(c.isNormal).toBe(false)
  })

  it('RR → PAIR_RR color, not normal', () => {
    const data = makePairedData(3)
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1))
    expect(c.colorType).toBe(LINKED_READ_COLOR_PAIR_RR)
    expect(c.isNormal).toBe(false)
  })

  it('LL → PAIR_LL color, not normal', () => {
    const data = makePairedData(4)
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1))
    expect(c.colorType).toBe(LINKED_READ_COLOR_PAIR_LL)
    expect(c.isNormal).toBe(false)
  })
})

describe('classifyPair — split long reads', () => {
  // p2Strand is negated for split reads in classifyPair. So:
  //   same actual strand (s1===s2): p1Strand === -p2Strand → SPLIT_NORMAL
  //   different actual strands:     p1Strand === p2Strand  → SPLIT_INV

  it('both fwd in BAM → SPLIT_NORMAL, inner junction endpoints, hasPaired=false', () => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, 1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      orientations: [0, 0],
      ys: [0, 1],
    })
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1))
    expect(c.hasPaired).toBe(false)
    expect(c.colorType).toBe(LINKED_READ_COLOR_SPLIT_NORMAL)
    expect(c.isNormal).toBe(true)
    expect(c.bp1).toBe(200) // right edge of left alignment
    expect(c.bp2).toBe(300) // left edge of right alignment
  })

  it('both rev in BAM → SPLIT_NORMAL, inner junction endpoints', () => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [-1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      orientations: [0, 0],
      ys: [0, 1],
    })
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1))
    expect(c.hasPaired).toBe(false)
    expect(c.colorType).toBe(LINKED_READ_COLOR_SPLIT_NORMAL)
    expect(c.isNormal).toBe(true)
    expect(c.bp1).toBe(200) // right edge, not 3-prime/start
    expect(c.bp2).toBe(300) // left edge, not 3-prime/end
  })

  it('fwd+rev inversion → SPLIT_INV, not normal', () => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      orientations: [0, 0],
      ys: [0, 1],
    })
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1))
    expect(c.hasPaired).toBe(false)
    expect(c.colorType).toBe(LINKED_READ_COLOR_SPLIT_INV)
    expect(c.isNormal).toBe(false)
  })

  it('rev+fwd inversion → SPLIT_INV, not normal', () => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [-1, 1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      orientations: [0, 0],
      ys: [0, 1],
    })
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1))
    expect(c.hasPaired).toBe(false)
    expect(c.colorType).toBe(LINKED_READ_COLOR_SPLIT_INV)
    expect(c.isNormal).toBe(false)
  })

  it('supp-first ordering (e1=supp at lower pos) still gives inner junction endpoints', () => {
    // Mirrors Read=7 in volvox-long-reads-sv.bam: supp appears before primary
    // in BAM position order because the supplementary maps to a lower genomic coord.
    const data = makeData({
      names: ['r', 'r'],
      flags: [SAM_FLAG_SUPPLEMENTARY, 0],
      strands: [-1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      orientations: [0, 0],
      ys: [0, 1],
    })
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1))
    expect(c.hasPaired).toBe(false)
    expect(c.isNormal).toBe(true)
    expect(c.bp1).toBe(200) // right edge of left (supp)
    expect(c.bp2).toBe(300) // left edge of right (primary)
  })
})

describe('filterEntries', () => {
  it('always removes secondary alignments', () => {
    const data = makeData({
      names: ['r', 'r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY, SAM_FLAG_SECONDARY],
      strands: [1, 1, 1],
      positions: [
        [100, 200],
        [300, 400],
        [500, 600],
      ],
      orientations: [0, 0, 0],
      ys: [0, 1, 2],
    })
    const entries = [makeEntry(data, 0), makeEntry(data, 1), makeEntry(data, 2)]
    const out = filterEntries(entries)
    expect(out).toHaveLength(2)
    expect(out[0]!.readIdx).toBe(0)
    expect(out[1]!.readIdx).toBe(1)
  })

  it('for non-paired reads: keeps supplementary, removes secondary', () => {
    const data = makeData({
      names: ['r', 'r', 'r'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY, SAM_FLAG_SECONDARY],
      strands: [1, 1, 1],
      positions: [
        [100, 200],
        [300, 400],
        [500, 600],
      ],
      orientations: [0, 0, 0],
      ys: [0, 1, 2],
    })
    const entries = [makeEntry(data, 0), makeEntry(data, 1), makeEntry(data, 2)]
    const out = filterEntries(entries)
    expect(out).toHaveLength(2)
    expect(out[0]!.readIdx).toBe(0) // primary kept
    expect(out[1]!.readIdx).toBe(1) // supplementary kept
  })

  it('for paired reads: removes supplementary and unmapped-mate, keeps normal mates', () => {
    const data = makeData({
      names: ['r', 'r', 'r'],
      flags: [
        SAM_FLAG_PAIRED,
        SAM_FLAG_PAIRED | SAM_FLAG_SUPPLEMENTARY,
        SAM_FLAG_PAIRED | SAM_FLAG_MATE_UNMAPPED,
      ],
      strands: [1, 1, 1],
      positions: [
        [100, 200],
        [300, 400],
        [500, 600],
      ],
      orientations: [1, 1, 1],
      ys: [0, 1, 2],
    })
    const entries = [makeEntry(data, 0), makeEntry(data, 1), makeEntry(data, 2)]
    const out = filterEntries(entries)
    expect(out).toHaveLength(1)
    expect(out[0]!.readIdx).toBe(0)
  })
})

describe('groupReadsByName', () => {
  it('groups reads by name across regions', () => {
    const data0 = makeData({
      names: ['r1'],
      flags: [SAM_FLAG_PAIRED],
      strands: [1],
      positions: [[100, 200]],
      orientations: [1],
      ys: [0],
    })
    const data1 = makeData({
      names: ['r1'],
      flags: [SAM_FLAG_PAIRED],
      strands: [-1],
      positions: [[300, 400]],
      orientations: [1],
      ys: [0],
    })
    const readsByName = groupReadsByName(
      new Map([
        [0, data0],
        [1, data1],
      ]),
    )
    expect(readsByName.get('r1')).toHaveLength(2)
  })
})

describe('computeLinkedReadLinesByRegion', () => {
  it('emits a line for a normal paired-LR pair, correct 3-prime endpoints', () => {
    const data = makeData({
      names: ['r1', 'r1'],
      flags: [SAM_FLAG_PAIRED, SAM_FLAG_PAIRED],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      orientations: [1, 1],
      ys: [0, 0],
    })
    const result = computeLinkedReadLinesByRegion(new Map([[0, data]]))
    expect(result.size).toBe(1)
    const lines = result.get(0)!
    expect(lines.numLines).toBe(1)
    expect(lines.colorTypes[0]).toBe(LINKED_READ_COLOR_PAIR_LR)
    expect(lines.positions[0]).toBe(200) // fwd 3-prime
    expect(lines.positions[1]).toBe(300) // rev 3-prime
  })

  it('excludes aberrant (RR) paired reads — bezier overlay handles them', () => {
    const data = makeData({
      names: ['r1', 'r1'],
      flags: [SAM_FLAG_PAIRED, SAM_FLAG_PAIRED],
      strands: [1, 1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      orientations: [3, 3],
      ys: [0, 0],
    })
    const result = computeLinkedReadLinesByRegion(new Map([[0, data]]))
    expect(result.size).toBe(0)
  })

  it('emits a line for a split-FR pair (both fwd), inner junction endpoints', () => {
    const data = makeData({
      names: ['r1', 'r1'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, 1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      orientations: [0, 0],
      ys: [0, 1],
    })
    const result = computeLinkedReadLinesByRegion(new Map([[0, data]]))
    expect(result.size).toBe(1)
    const lines = result.get(0)!
    expect(lines.numLines).toBe(1)
    expect(lines.colorTypes[0]).toBe(LINKED_READ_COLOR_SPLIT_NORMAL)
    expect(lines.positions[0]).toBe(200) // right edge of left alignment
    expect(lines.positions[1]).toBe(300) // left edge of right alignment
    expect(lines.ys[0]).toBe(0)
    expect(lines.ys[1]).toBe(1)
  })

  it('emits a line for a split-RF pair (both rev), inner junction endpoints', () => {
    const data = makeData({
      names: ['r1', 'r1'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [-1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      orientations: [0, 0],
      ys: [2, 3],
    })
    const result = computeLinkedReadLinesByRegion(new Map([[0, data]]))
    expect(result.size).toBe(1)
    const lines = result.get(0)!
    expect(lines.numLines).toBe(1)
    expect(lines.colorTypes[0]).toBe(LINKED_READ_COLOR_SPLIT_NORMAL)
    expect(lines.positions[0]).toBe(200)
    expect(lines.positions[1]).toBe(300)
  })

  it('supp-first ordering produces correct inner junction endpoints', () => {
    const data = makeData({
      names: ['r1', 'r1'],
      flags: [SAM_FLAG_SUPPLEMENTARY, 0],
      strands: [-1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      orientations: [0, 0],
      ys: [0, 1],
    })
    const result = computeLinkedReadLinesByRegion(new Map([[0, data]]))
    const lines = result.get(0)!
    expect(lines.numLines).toBe(1)
    expect(lines.positions[0]).toBe(200)
    expect(lines.positions[1]).toBe(300)
  })

  it('excludes split inversions (SPLIT_INV) — bezier overlay handles them', () => {
    const data = makeData({
      names: ['r1', 'r1'],
      flags: [0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, -1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      orientations: [0, 0],
      ys: [0, 1],
    })
    const result = computeLinkedReadLinesByRegion(new Map([[0, data]]))
    expect(result.size).toBe(0)
  })

  it('excludes cross-region pairs', () => {
    const data0 = makeData({
      names: ['r1'],
      flags: [SAM_FLAG_PAIRED],
      strands: [1],
      positions: [[100, 200]],
      orientations: [1],
      ys: [0],
    })
    const data1 = makeData({
      names: ['r1'],
      flags: [SAM_FLAG_PAIRED],
      strands: [-1],
      positions: [[300, 400]],
      orientations: [1],
      ys: [0],
    })
    const result = computeLinkedReadLinesByRegion(
      new Map([
        [0, data0],
        [1, data1],
      ]),
    )
    expect(result.size).toBe(0)
  })

  it('skips reads with no pair (singleton)', () => {
    const data = makeData({
      names: ['only'],
      flags: [0],
      strands: [1],
      positions: [[100, 200]],
      orientations: [0],
      ys: [0],
    })
    const result = computeLinkedReadLinesByRegion(new Map([[0, data]]))
    expect(result.size).toBe(0)
  })

  it('handles multiple read pairs in the same region', () => {
    const data = makeData({
      names: ['r1', 'r1', 'r2', 'r2'],
      flags: [
        SAM_FLAG_PAIRED,
        SAM_FLAG_PAIRED,
        SAM_FLAG_PAIRED,
        SAM_FLAG_PAIRED,
      ],
      strands: [1, -1, 1, -1],
      positions: [
        [100, 200],
        [300, 400],
        [500, 600],
        [700, 800],
      ],
      orientations: [1, 1, 1, 1],
      ys: [0, 0, 1, 1],
    })
    const result = computeLinkedReadLinesByRegion(new Map([[0, data]]))
    const lines = result.get(0)!
    expect(lines.numLines).toBe(2)
  })

  it('mixed dataset: paired and split reads classified independently', () => {
    // With the old global hasPaired flag, if any read was paired the supplementary
    // long-read connections would be suppressed. Per-pair classification fixes this:
    // paired mates use orientNum, split long reads use strand comparison.
    const data = makeData({
      names: ['short', 'short', 'long', 'long'],
      flags: [
        SAM_FLAG_PAIRED, // short read mate 1
        SAM_FLAG_PAIRED, // short read mate 2
        0, // long read primary
        SAM_FLAG_SUPPLEMENTARY, // long read supplementary
      ],
      strands: [1, -1, 1, 1],
      positions: [
        [100, 200],
        [300, 400],
        [500, 600],
        [700, 800],
      ],
      orientations: [1, 1, 0, 0],
      ys: [0, 0, 1, 1],
    })
    const result = computeLinkedReadLinesByRegion(new Map([[0, data]]))
    const lines = result.get(0)!
    // Both pairs emit lines: the LR paired reads and the FR split reads
    expect(lines.numLines).toBe(2)
    expect(lines.colorTypes[0]).toBe(LINKED_READ_COLOR_PAIR_LR)
    expect(lines.colorTypes[1]).toBe(LINKED_READ_COLOR_SPLIT_NORMAL)
  })
})
