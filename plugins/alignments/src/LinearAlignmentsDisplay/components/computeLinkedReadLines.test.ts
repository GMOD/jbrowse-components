import {
  LINKED_READ_COLOR_PAIR_LR,
  LINKED_READ_COLOR_PAIR_RL,
  LINKED_READ_COLOR_PAIR_RR,
  LINKED_READ_COLOR_SPLIT_FR,
  LINKED_READ_COLOR_SPLIT_RF,
  LINKED_READ_COLOR_SPLIT_SAME,
  classifyPair,
  computeLinkedReadLinesByRegion,
  connectionBp,
  isNormalOrientation,
} from './computeLinkedReadLines.ts'

import type { ReadEntry } from './computeLinkedReadLines.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'

const SAM_FLAG_PAIRED = 1
const SAM_FLAG_SUPPLEMENTARY = 2048

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

  it('split second forward: inverted → start', () => {
    expect(connectionBp(false, 1, 100, 200, true)).toBe(100)
  })

  it('split second reverse: inverted → end', () => {
    expect(connectionBp(false, -1, 100, 200, true)).toBe(200)
  })

  it('split first forward: 3-prime end', () => {
    expect(connectionBp(false, 1, 100, 200, false)).toBe(200)
  })
})

describe('isNormalOrientation', () => {
  it('paired LR (orient 1) → normal', () => {
    expect(isNormalOrientation(true, 1, 1, -1)).toBe(true)
  })

  it('paired orient 0 → normal (degenerate)', () => {
    expect(isNormalOrientation(true, 0, 1, -1)).toBe(true)
  })

  it('paired RR (orient 3) → not normal', () => {
    expect(isNormalOrientation(true, 3, 1, -1)).toBe(false)
  })

  it('paired RL (orient 2) → not normal', () => {
    expect(isNormalOrientation(true, 2, 1, -1)).toBe(false)
  })

  it('split FR (s1=1, p2Strand=-1) → normal', () => {
    expect(isNormalOrientation(false, 0, 1, -1)).toBe(true)
  })

  it('split RF (s1=-1, p2Strand=1) → not normal', () => {
    expect(isNormalOrientation(false, 0, -1, 1)).toBe(false)
  })

  it('split same-strand → not normal', () => {
    expect(isNormalOrientation(false, 0, 1, 1)).toBe(false)
  })
})

describe('classifyPair color types', () => {
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

  it('paired LR → PAIR_LR color', () => {
    const data = makePairedData(1)
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1), true)
    expect(c.colorType).toBe(LINKED_READ_COLOR_PAIR_LR)
    expect(c.isNormal).toBe(true)
  })

  it('paired RL → PAIR_RL color, not normal', () => {
    const data = makePairedData(2)
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1), true)
    expect(c.colorType).toBe(LINKED_READ_COLOR_PAIR_RL)
    expect(c.isNormal).toBe(false)
  })

  it('paired RR → PAIR_RR color, not normal', () => {
    const data = makePairedData(3)
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1), true)
    expect(c.colorType).toBe(LINKED_READ_COLOR_PAIR_RR)
    expect(c.isNormal).toBe(false)
  })

  // p2Strand is negated for split reads in classifyPair. So:
  //   SPLIT_FR (normal):  s1=1, s2=1  → p2Strand=-1 → splitColorType(1,-1)=FR
  //   SPLIT_RF (not normal): s1=-1, s2=-1 → p2Strand=1 → splitColorType(-1,1)=RF
  //   SPLIT_SAME (not normal): mixed strands → p2Strand same sign as s1

  it('split FR (both fwd in BAM) → SPLIT_FR, normal', () => {
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
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1), false)
    expect(c.colorType).toBe(LINKED_READ_COLOR_SPLIT_FR)
    expect(c.isNormal).toBe(true)
  })

  it('split RF (both rev in BAM) → SPLIT_RF, not normal', () => {
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
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1), false)
    expect(c.colorType).toBe(LINKED_READ_COLOR_SPLIT_RF)
    expect(c.isNormal).toBe(false)
  })

  it('split same-strand (fwd primary, rev supp) → SPLIT_SAME, not normal', () => {
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
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1), false)
    expect(c.colorType).toBe(LINKED_READ_COLOR_SPLIT_SAME)
    expect(c.isNormal).toBe(false)
  })
})

describe('computeLinkedReadLinesByRegion', () => {
  it('emits a line for a normal paired-LR pair in the same region', () => {
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
    const result = computeLinkedReadLinesByRegion({
      laidOutPileupMap: new Map([[0, data]]),
    })
    expect(result.size).toBe(1)
    const lines = result.get(0)!
    expect(lines.numLines).toBe(1)
    expect(lines.colorTypes[0]).toBe(LINKED_READ_COLOR_PAIR_LR)
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
    const result = computeLinkedReadLinesByRegion({
      laidOutPileupMap: new Map([[0, data]]),
    })
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
    const result = computeLinkedReadLinesByRegion({
      laidOutPileupMap: new Map([
        [0, data0],
        [1, data1],
      ]),
    })
    expect(result.size).toBe(0)
  })

  it('emits a line for a normal split-FR pair (both fwd in BAM)', () => {
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
    const result = computeLinkedReadLinesByRegion({
      laidOutPileupMap: new Map([[0, data]]),
    })
    expect(result.size).toBe(1)
    const lines = result.get(0)!
    expect(lines.numLines).toBe(1)
    expect(lines.colorTypes[0]).toBe(LINKED_READ_COLOR_SPLIT_FR)
    // Per-endpoint Y — mates on different rows
    expect(lines.ys[0]).toBe(0)
    expect(lines.ys[1]).toBe(1)
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
    const result = computeLinkedReadLinesByRegion({
      laidOutPileupMap: new Map([[0, data]]),
    })
    expect(result.size).toBe(0)
  })

  it('positions are absolute genomic uint32', () => {
    // bp1 should be the 3-prime end of the forward read (end=200)
    // bp2 should be the 3-prime end of the reverse read (start=300)
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
    const result = computeLinkedReadLinesByRegion({
      laidOutPileupMap: new Map([[0, data]]),
    })
    const lines = result.get(0)!
    expect(lines.positions[0]).toBe(200) // fwd 3-prime
    expect(lines.positions[1]).toBe(300) // rev 3-prime
  })
})
