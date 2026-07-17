import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'

import {
  LINKED_READ_COLOR_PAIR_LL,
  LINKED_READ_COLOR_PAIR_LR,
  LINKED_READ_COLOR_PAIR_RL,
  LINKED_READ_COLOR_PAIR_RR,
  LINKED_READ_COLOR_SPLIT_INV,
  LINKED_READ_COLOR_SPLIT_NORMAL,
  classifyPair,
  computeLinkedReadLinesByRegion,
  groupReadsByName,
  isNormalOrientation,
} from './compute.ts'
import {
  connectionEndpoints,
  readGroupConnections,
} from '../../shared/readGroupConnections.ts'

import type { ReadEntry } from './compute.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// Minimal PileupDataResult with only the fields used by these functions.
function makeData(opts: {
  names: string[]
  flags: number[]
  strands: number[]
  positions: number[][]
  orientations: number[]
  ys: number[]
  // clip-at-start-of-read (read-order sort key); defaults to 0 (genomic order)
  clips?: number[]
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
    readClipAtStart: Uint32Array.from(opts.clips ?? opts.names.map(() => 0)),
  } as unknown as PileupDataResult
}

function makeEntry(
  data: PileupDataResult,
  readIdx: number,
  displayedRegionIndex = 0,
): ReadEntry {
  return { data, readIdx, displayedRegionIndex }
}

describe('connectionEndpoints', () => {
  const conn = (s1: number, s2: number, isSplit: boolean) => {
    const data = makeData({
      names: ['r', 'r'],
      flags: [0, 0],
      strands: [s1, s2],
      positions: [
        [100, 200],
        [300, 400],
      ],
      orientations: [0, 0],
      ys: [0, 0],
    })
    return connectionEndpoints({
      e1: makeEntry(data, 0),
      e2: makeEntry(data, 1),
      isSplit,
    })
  }

  it('paired: both endpoints are the read-trailing (3-prime) edge', () => {
    expect(conn(1, 1, false)).toMatchObject({ bp1: 200, bp2: 400 })
    expect(conn(-1, -1, false)).toMatchObject({ bp1: 100, bp2: 300 })
  })

  it('split: e1 read-trailing (3-prime), e2 read-leading (5-prime)', () => {
    expect(conn(1, 1, true)).toMatchObject({ bp1: 200, bp2: 300 })
    expect(conn(-1, -1, true)).toMatchObject({ bp1: 100, bp2: 400 })
  })

  it('split inversion joins the breakpoint edges, exposing real strands', () => {
    expect(conn(1, -1, true)).toMatchObject({
      bp1: 200,
      bp2: 400,
      s1: 1,
      s2: -1,
    })
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

  it('split both fwd (s1=1, s2=1) → normal (deletion)', () => {
    expect(isNormalOrientation(false, 0, 1, 1)).toBe(true)
  })

  it('split both rev (s1=-1, s2=-1) → normal (reverse-strand deletion)', () => {
    expect(isNormalOrientation(false, 0, -1, -1)).toBe(true)
  })

  it('split fwd+rev inversion (s1=1, s2=-1) → not normal', () => {
    expect(isNormalOrientation(false, 0, 1, -1)).toBe(false)
  })

  it('split rev+fwd inversion (s1=-1, s2=1) → not normal', () => {
    expect(isNormalOrientation(false, 0, -1, 1)).toBe(false)
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

  it('LR → PAIR_LR color, normal, 3-prime endpoints, isSplit=false', () => {
    const data = makePairedData(1)
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1), false)
    expect(c.isSplit).toBe(false)
    expect(c.colorType).toBe(LINKED_READ_COLOR_PAIR_LR)
    expect(c.isNormal).toBe(true)
    expect(c.bp1).toBe(200) // fwd 3-prime = end
    expect(c.bp2).toBe(300) // rev 3-prime = start
  })

  it('RL → PAIR_RL color, not normal', () => {
    const data = makePairedData(2)
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1), false)
    expect(c.isSplit).toBe(false)
    expect(c.colorType).toBe(LINKED_READ_COLOR_PAIR_RL)
    expect(c.isNormal).toBe(false)
  })

  it('RR → PAIR_RR color, not normal', () => {
    const data = makePairedData(3)
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1), false)
    expect(c.colorType).toBe(LINKED_READ_COLOR_PAIR_RR)
    expect(c.isNormal).toBe(false)
  })

  it('LL → PAIR_LL color, not normal', () => {
    const data = makePairedData(4)
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1), false)
    expect(c.colorType).toBe(LINKED_READ_COLOR_PAIR_LL)
    expect(c.isNormal).toBe(false)
  })
})

describe('classifyPair — split long reads', () => {
  // A split read is normal (a plain deletion) when both segments share a strand,
  // and an inversion when they differ. classifyPair exposes the real BAM s1/s2
  // on the returned record for downstream geometry.

  it('both fwd, read order e1→e2 → SPLIT_NORMAL, a.end→b.start junction', () => {
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
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1), true)
    expect(c.isSplit).toBe(true)
    expect(c.colorType).toBe(LINKED_READ_COLOR_SPLIT_NORMAL)
    expect(c.isNormal).toBe(true)
    expect(c.bp1).toBe(200) // e1 fwd: read-trailing (3') edge = end
    expect(c.bp2).toBe(300) // e2 fwd: read-leading (5') edge = start
  })

  it('both rev, read order e1→e2 → SPLIT_NORMAL, strand-flipped edges', () => {
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
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1), true)
    expect(c.isSplit).toBe(true)
    expect(c.colorType).toBe(LINKED_READ_COLOR_SPLIT_NORMAL)
    expect(c.isNormal).toBe(true)
    expect(c.bp1).toBe(100) // e1 rev: read-trailing (3') edge = start
    expect(c.bp2).toBe(400) // e2 rev: read-leading (5') edge = end
  })

  it('fwd+rev inversion → SPLIT_INV, connects a2↔b2 (both ends), real s2', () => {
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
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1), true)
    expect(c.isSplit).toBe(true)
    expect(c.colorType).toBe(LINKED_READ_COLOR_SPLIT_INV)
    expect(c.isNormal).toBe(false)
    // The fix: a1 fwd → a.end (200, =a2); b rev → b.end (400, =b2). Connects
    // a2↔b2, not a2↔b1 (300) which landed on the far edge of the rev segment.
    expect(c.bp1).toBe(200)
    expect(c.bp2).toBe(400)
    // Geometry consumers (bezier tangents) need the BAM strand, not the
    // classifier-negated form. Regression guard for the overloaded-field bug.
    expect(c.s1).toBe(1)
    expect(c.s2).toBe(-1)
  })

  it('rev+fwd inversion → SPLIT_INV, connects a.start↔b.start, real s2', () => {
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
    const c = classifyPair(makeEntry(data, 0), makeEntry(data, 1), true)
    expect(c.isSplit).toBe(true)
    expect(c.colorType).toBe(LINKED_READ_COLOR_SPLIT_INV)
    expect(c.isNormal).toBe(false)
    expect(c.bp1).toBe(100) // e1 rev: read-trailing edge = start
    expect(c.bp2).toBe(300) // e2 fwd: read-leading edge = start
    expect(c.s1).toBe(-1)
    expect(c.s2).toBe(1)
  })
})

describe('readGroupConnections', () => {
  it('always drops secondary alignments', () => {
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
    const cs = readGroupConnections([
      makeEntry(data, 0),
      makeEntry(data, 1),
      makeEntry(data, 2),
    ])
    // only the primary↔supp split junction survives (secondary excluded)
    expect(cs).toHaveLength(1)
    expect(cs[0]!.isSplit).toBe(true)
    expect(cs[0]!.e1.readIdx).toBe(0)
    expect(cs[0]!.e2.readIdx).toBe(1)
  })

  it('dedupes one read appearing in two regions (collapsed introns), no self-junction', () => {
    // A single unpaired alignment overlapping two collapsed-intron exon regions
    // is returned by BOTH region fetches, so it appears as two same-name entries
    // sharing a readId (f.id() = adapter.id + fileOffset is stable across
    // fetches). Without dedup, the two copies look like a 2-segment split read
    // and chainSubRead fabricates a junction between the read and itself.
    const regionA = makeData({
      names: ['r1'],
      flags: [0],
      strands: [1],
      positions: [[100, 5000]],
      orientations: [0],
      ys: [0],
    })
    const regionB = makeData({
      names: ['r1'],
      flags: [0],
      strands: [1],
      positions: [[100, 5000]],
      orientations: [0],
      ys: [0],
    })
    // both copies carry readId 'id0' (same fileOffset → same stable f.id())
    const cs = readGroupConnections([
      makeEntry(regionA, 0, 0),
      makeEntry(regionB, 0, 1),
    ])
    expect(cs).toHaveLength(0)
  })

  it('keeps a genuine split read whose segments are separate records (distinct ids)', () => {
    // Contrast with the dedup case: a real split read's primary + supplementary
    // are distinct records (distinct fileOffsets → distinct readIds), so they
    // must NOT be deduped even when they land in different regions.
    const regionA = makeData({
      names: ['r1'],
      flags: [0],
      strands: [1],
      positions: [[100, 200]],
      orientations: [0],
      ys: [0],
    })
    const regionB = makeData({
      names: ['r1'],
      flags: [SAM_FLAG_SUPPLEMENTARY],
      strands: [1],
      positions: [[300, 400]],
      orientations: [0],
      ys: [0],
    })
    regionA.readIds[0] = 'primary'
    regionB.readIds[0] = 'supplementary'
    const cs = readGroupConnections([
      makeEntry(regionA, 0, 0),
      makeEntry(regionB, 0, 1),
    ])
    expect(cs).toHaveLength(1)
    expect(cs[0]!.isSplit).toBe(true)
  })

  it('unpaired: chains 3 split segments in read order (clip-at-start), not genomic order', () => {
    // Genomic order idx0<idx1<idx2 but read order is idx1→idx2→idx0 by clip.
    const data = makeData({
      names: ['r', 'r', 'r'],
      flags: [SAM_FLAG_SUPPLEMENTARY, 0, SAM_FLAG_SUPPLEMENTARY],
      strands: [1, 1, 1],
      positions: [
        [100, 200],
        [300, 400],
        [500, 600],
      ],
      orientations: [0, 0, 0],
      ys: [0, 1, 2],
      clips: [200, 0, 100],
    })
    const cs = readGroupConnections([
      makeEntry(data, 0),
      makeEntry(data, 1),
      makeEntry(data, 2),
    ])
    expect(cs.map(c => [c.e1.readIdx, c.e2.readIdx, c.isSplit])).toEqual([
      [1, 2, true],
      [2, 0, true],
    ])
  })

  it('mate-unmapped split read keeps its split junction, emits no dangling link', () => {
    // Realistic scenario: read1's mate is unmapped (so has no position and is
    // never fetched here), but read1 is itself SA-split into a primary +
    // supplementary — both flagged mate-unmapped. The within-read split junction
    // must still be drawn; no mate link is emitted because no second mate is
    // present. (A read flagged mate-unmapped never appears next to the mate it
    // declares unmapped, so filtering it out only ever deleted this junction.)
    const data = makeData({
      names: ['r', 'r'],
      flags: [
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR | SAM_FLAG_MATE_UNMAPPED,
        SAM_FLAG_PAIRED |
          SAM_FLAG_FIRST_IN_PAIR |
          SAM_FLAG_SUPPLEMENTARY |
          SAM_FLAG_MATE_UNMAPPED,
      ],
      strands: [1, 1],
      positions: [
        [100, 200],
        [300, 400],
      ],
      orientations: [1, 1],
      ys: [0, 0],
      clips: [0, 50],
    })
    const cs = readGroupConnections([makeEntry(data, 0), makeEntry(data, 1)])
    expect(cs).toHaveLength(1)
    expect(cs[0]!.isSplit).toBe(true)
    expect([cs[0]!.e1.readIdx, cs[0]!.e2.readIdx]).toEqual([0, 1])
  })

  it('paired + SA-split: per-mate junction kept AND the mate link drawn', () => {
    // read1 (first-in-pair) is itself split into primary+supplementary; read2
    // (second-in-pair) is a single alignment.
    const data = makeData({
      names: ['r', 'r', 'r'],
      flags: [
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR | SAM_FLAG_SUPPLEMENTARY,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ],
      strands: [1, 1, -1],
      positions: [
        [100, 200],
        [300, 400],
        [700, 800],
      ],
      orientations: [1, 1, 1],
      ys: [0, 0, 0],
      clips: [0, 50, 0],
    })
    const cs = readGroupConnections([
      makeEntry(data, 0),
      makeEntry(data, 1),
      makeEntry(data, 2),
    ])
    // read1's within-read split junction (idx0→idx1) plus the read1↔read2 mate
    // link sourced from each mate's primary (idx0, idx2).
    expect(cs).toHaveLength(2)
    expect([cs[0]!.e1.readIdx, cs[0]!.e2.readIdx, cs[0]!.isSplit]).toEqual([
      0,
      1,
      true,
    ])
    expect([cs[1]!.e1.readIdx, cs[1]!.e2.readIdx, cs[1]!.isSplit]).toEqual([
      0,
      2,
      false,
    ])
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
      flags: [
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ],
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
    expect(lines.numLinkedReadLines).toBe(1)
    expect(lines.linkedReadLineColorTypes[0]).toBe(LINKED_READ_COLOR_PAIR_LR)
    expect(lines.linkedReadLinePositions[0]).toBe(200) // fwd 3-prime
    expect(lines.linkedReadLinePositions[1]).toBe(300) // rev 3-prime
  })

  it('excludes aberrant (RR) paired reads — bezier overlay handles them', () => {
    const data = makeData({
      names: ['r1', 'r1'],
      flags: [
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      ],
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
    expect(lines.numLinkedReadLines).toBe(1)
    expect(lines.linkedReadLineColorTypes[0]).toBe(
      LINKED_READ_COLOR_SPLIT_NORMAL,
    )
    expect(lines.linkedReadLinePositions[0]).toBe(200) // right edge of left alignment
    expect(lines.linkedReadLinePositions[1]).toBe(300) // left edge of right alignment
    expect(lines.linkedReadLineYs[0]).toBe(0)
    expect(lines.linkedReadLineYs[1]).toBe(1)
  })

  it('emits a line for a split deletion, both rev, read-ordered by clip', () => {
    // Reverse-strand read: read order runs high→low genomic, so the [300,400]
    // segment is read-first (smaller clip). The junction joins its 3' edge
    // (start=300) to the next segment's 5' edge (end=200) — the inner gap edges.
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
      clips: [100, 0],
    })
    const result = computeLinkedReadLinesByRegion(new Map([[0, data]]))
    expect(result.size).toBe(1)
    const lines = result.get(0)!
    expect(lines.numLinkedReadLines).toBe(1)
    expect(lines.linkedReadLineColorTypes[0]).toBe(
      LINKED_READ_COLOR_SPLIT_NORMAL,
    )
    expect(lines.linkedReadLinePositions[0]).toBe(300)
    expect(lines.linkedReadLinePositions[1]).toBe(200)
  })

  it('clip sort reorders a supp-first array into read order', () => {
    // Supplementary stored before the primary, primary maps lower. The clip key
    // (primary read-first) drives the order, recovering the a.end→b.start
    // junction regardless of array position.
    const data = makeData({
      names: ['r1', 'r1'],
      flags: [SAM_FLAG_SUPPLEMENTARY, 0],
      strands: [1, 1],
      positions: [
        [300, 400],
        [100, 200],
      ],
      orientations: [0, 0],
      ys: [0, 1],
      clips: [100, 0],
    })
    const result = computeLinkedReadLinesByRegion(new Map([[0, data]]))
    const lines = result.get(0)!
    expect(lines.numLinkedReadLines).toBe(1)
    expect(lines.linkedReadLinePositions[0]).toBe(200)
    expect(lines.linkedReadLinePositions[1]).toBe(300)
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
      flags: [SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR],
      strands: [1],
      positions: [[100, 200]],
      orientations: [1],
      ys: [0],
    })
    const data1 = makeData({
      names: ['r1'],
      flags: [SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR],
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
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
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
    expect(lines.numLinkedReadLines).toBe(2)
  })

  it('mixed dataset: paired and split reads classified independently', () => {
    // With the old global hasPaired flag, if any read was paired the supplementary
    // long-read connections would be suppressed. Per-pair classification fixes this:
    // paired mates use orientNum, split long reads use strand comparison.
    const data = makeData({
      names: ['short', 'short', 'long', 'long'],
      flags: [
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR, // short read mate 1
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR, // short read mate 2
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
    expect(lines.numLinkedReadLines).toBe(2)
    expect(lines.linkedReadLineColorTypes[0]).toBe(LINKED_READ_COLOR_PAIR_LR)
    expect(lines.linkedReadLineColorTypes[1]).toBe(
      LINKED_READ_COLOR_SPLIT_NORMAL,
    )
  })
})
