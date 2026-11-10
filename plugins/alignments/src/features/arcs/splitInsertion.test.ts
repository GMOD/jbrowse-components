import { SimpleFeature } from '@jbrowse/core/util'

import { pileupDataFromSamRecords } from '../../LinearAlignmentsDisplay/samRecordFixture.ts'
import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { arcSlotCategory } from '../../shaders/palettes.ts'
import { piecesOf, splitReadKind } from '../../shared/splitReadJunctions.ts'
import { iterLinkedPairs } from '../linkedReads/compute.ts'
import { collectPendingArcs, groupReadsByName } from './arcChains.ts'
import {
  ARC_COLOR_SPLIT_BACK,
  ARC_COLOR_SPLIT_FORWARD,
  ARC_COLOR_SPLIT_INSERTION,
  ARC_COLOR_SPLIT_INV_LL,
  ARC_COLOR_SPLIT_INV_RR,
  getArcColorType,
  splitJunctionSlot,
} from './arcColors.ts'

import type { SamRecordFixture } from '../../LinearAlignmentsDisplay/samRecordFixture.ts'
import type { SvKind } from '../../shared/readFieldLevels.ts'

// A same-strand junction by the reference it skips in the read's direction
// and the read bases between its pieces, on either strand.
function sameStrand(refGap: number, readGap: number, strand = 1) {
  const bp1 = 10_000
  return splitJunctionSlot(strand, bp1, strand, bp1 + refGap * strand, readGap)
}

describe('a same-strand split junction is an insertion', () => {
  test.each([1, -1])('at the read-gap floor, strand %i', strand => {
    expect(sameStrand(10, 49, strand)).toBe(ARC_COLOR_SPLIT_FORWARD)
    expect(sameStrand(10, 50, strand)).toBe(ARC_COLOR_SPLIT_INSERTION)
    expect(sameStrand(-10, 49, strand)).toBe(ARC_COLOR_SPLIT_BACK)
    expect(sameStrand(-10, 50, strand)).toBe(ARC_COLOR_SPLIT_INSERTION)
  })

  test.each([1, -1])(
    'while the pieces overlap or miss by at most half the read gap, strand %i',
    strand => {
      expect(sameStrand(-50, 100, strand)).toBe(ARC_COLOR_SPLIT_INSERTION)
      expect(sameStrand(-51, 100, strand)).toBe(ARC_COLOR_SPLIT_BACK)
      expect(sameStrand(30, 60, strand)).toBe(ARC_COLOR_SPLIT_INSERTION)
      expect(sameStrand(31, 60, strand)).toBe(ARC_COLOR_SPLIT_FORWARD)
    },
  )

  test.each([1, -1])(
    'unless it skips an SV-size stretch of reference, strand %i',
    strand => {
      expect(sameStrand(49, 1000, strand)).toBe(ARC_COLOR_SPLIT_INSERTION)
      expect(sameStrand(50, 1000, strand)).toBe(ARC_COLOR_SPLIT_FORWARD)
      expect(sameStrand(50, 100, strand)).toBe(ARC_COLOR_SPLIT_FORWARD)
    },
  )

  test.each([1, -1])('with its feet on one base, strand %i', strand => {
    expect(sameStrand(0, 0, strand)).toBe(ARC_COLOR_SPLIT_INSERTION)
    expect(sameStrand(0, 5000, strand)).toBe(ARC_COLOR_SPLIT_INSERTION)
  })

  test('as the measured long reads cross a Tier1 insertion', () => {
    expect(sameStrand(-15, 6100)).toBe(ARC_COLOR_SPLIT_INSERTION)
    expect(sameStrand(10, 1745)).toBe(ARC_COLOR_SPLIT_INSERTION)
  })

  test('and a clean tandem duplication or deletion is not', () => {
    expect(sameStrand(-5000, 0)).toBe(ARC_COLOR_SPLIT_BACK)
    expect(sameStrand(5000, 0)).toBe(ARC_COLOR_SPLIT_FORWARD)
  })

  test('an inversion junction keeps its class whatever the read gap', () => {
    expect(splitJunctionSlot(1, 10_000, -1, 10_010, 6000)).toBe(
      ARC_COLOR_SPLIT_INV_LL,
    )
    expect(splitJunctionSlot(-1, 10_000, 1, 9990, 6000)).toBe(
      ARC_COLOR_SPLIT_INV_RR,
    )
    expect(splitJunctionSlot(1, 10_000, -1, 10_000, 6000)).toBe(
      ARC_COLOR_SPLIT_INV_LL,
    )
  })
})

interface Piece {
  // 0-based start on ctgA
  start: number
  // reference-orientation CIGAR, as SAM and the SA tag spell it
  cigar: string
  strand: number
}

const L = 10_000

// Two pieces of one read, the first aligning the read's first 1,000 bases and
// the second `aligned` bases from `clip` on, each clipping the rest.
function pieces(
  firstStart: number,
  secondStart: number,
  clip: number,
  secondStrand = 1,
): [Piece, Piece] {
  const aligned = 1000
  const rest = L - clip - aligned
  return [
    { start: firstStart, cigar: `1000M${L - 1000}S`, strand: 1 },
    {
      start: secondStart,
      cigar:
        secondStrand === 1
          ? `${clip}H${aligned}M${rest}H`
          : `${rest}H${aligned}M${clip}H`,
      strand: secondStrand,
    },
  ]
}

// The same molecule sequenced from its other end: every piece on the other
// strand, its alignment on the reference unchanged.
function fromOtherEnd(read: Piece[]) {
  return read.map(p => ({ ...p, strand: -p.strand }))
}

function saEntry(p: Piece) {
  return `ctgA,${p.start + 1},${p.strand === -1 ? '-' : '+'},${p.cigar},60,0;`
}

function records(read: Piece[]): SamRecordFixture[] {
  return read.map((p, i) => ({
    name: 'r',
    flag: (i === 0 ? 0 : 2048) | (p.strand === -1 ? 16 : 0),
    strand: p.strand,
    pos: p.start + 1,
    CIGAR: p.cigar,
    SA: read
      .filter((_, j) => j !== i)
      .map(saEntry)
      .join(''),
  }))
}

const KIND_OF_SLOT: Record<number, SvKind> = {
  [ARC_COLOR_SPLIT_FORWARD]: 'deletionType',
  [ARC_COLOR_SPLIT_BACK]: 'duplicationType',
  [ARC_COLOR_SPLIT_INV_LL]: 'inversion',
  [ARC_COLOR_SPLIT_INV_RR]: 'inversion',
  [ARC_COLOR_SPLIT_INSERTION]: 'insertion',
}

// What each of the three classifiers makes of one split read: the band each of
// its records files in, the read-connection arc's slot, and the connector's.
function classified(read: Piece[]) {
  const recs = records(read)
  const data = pileupDataFromSamRecords(recs)
  const band = recs.map(r =>
    splitReadKind(
      piecesOf(
        new SimpleFeature({
          uniqueId: `${r.pos}`,
          refName: 'ctgA',
          start: r.pos - 1,
          end: data.readPositions[recs.indexOf(r) * 2 + 1]!,
          strand: r.strand,
          CIGAR: r.CIGAR,
          flags: r.flag,
          score: 60,
        }),
        r.SA,
      ),
    ),
  )
  const arcs = collectPendingArcs(
    groupReadsByName(
      new Map([[0, data]]),
      [{ refName: 'ctgA', start: 0, end: 50_000, displayedRegionIndex: 0 }],
      '',
    ),
    { filter: {}, canonicalRefName: name => name },
  ).map(getArcColorType)
  const connectors = [
    ...iterLinkedPairs(
      new Map([
        [
          0,
          makePileupDataResult({
            ...data,
            readYs: new Uint16Array(recs.length),
            maxY: 1,
          }),
        ],
      ]),
    ),
  ].map(p => p.c.colorType)
  return { band, arcs, connectors }
}

describe('the band, the arc and the connector class one junction alike', () => {
  const cases: [string, [Piece, Piece], number][] = [
    [
      'an insertion inside a target-site duplication',
      pieces(1000, 1985, 7100),
      ARC_COLOR_SPLIT_INSERTION,
    ],
    [
      'an insertion missing a few bases',
      pieces(1000, 2010, 2745),
      ARC_COLOR_SPLIT_INSERTION,
    ],
    ['feet on one base', pieces(1000, 2000, 1000), ARC_COLOR_SPLIT_INSERTION],
    ['a deletion', pieces(1000, 7000, 1000), ARC_COLOR_SPLIT_FORWARD],
    ['a tandem duplication', pieces(6000, 2000, 1000), ARC_COLOR_SPLIT_BACK],
    [
      'a deletion beside an inserted stretch',
      pieces(1000, 2100, 1300),
      ARC_COLOR_SPLIT_FORWARD,
    ],
    [
      'an inversion entered from the left',
      pieces(1000, 5000, 7100, -1),
      ARC_COLOR_SPLIT_INV_LL,
    ],
  ]
  test.each(cases)('%s, read from either end', (_name, read, slot) => {
    for (const r of [read, fromOtherEnd(read)]) {
      const { band, arcs, connectors } = classified(r)
      expect({
        band,
        arcs: arcs.map(arcSlotCategory),
        connectors: connectors.map(arcSlotCategory),
      }).toEqual({
        band: [KIND_OF_SLOT[slot], KIND_OF_SLOT[slot]],
        arcs: [arcSlotCategory(slot)],
        connectors: [arcSlotCategory(slot)],
      })
    }
  })
})
