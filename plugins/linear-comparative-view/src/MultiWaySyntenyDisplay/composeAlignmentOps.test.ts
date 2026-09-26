import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_RUN,
  CIGAR_X,
} from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import { composeAlignmentOps } from './composeAlignmentOps.ts'

import type { LanePlacementRecord } from './composeLaneLinks.ts'

function ops(...pairs: [number, number][]) {
  return Uint32Array.from(pairs.map(([len, op]) => (len << 4) | op))
}

function unpack(packed: Uint32Array) {
  return [...packed].map(v => [v >>> 4, v & 0xf] as [number, number])
}

/**
 * A lane's record against the anchor, in the shape the display's own fetch
 * hands it: the feature is the ANCHOR's record and its mate is the lane.
 */
function rec(
  id: string,
  laneRef: string,
  laneStart: number,
  laneEnd: number,
  alignmentOps: Uint32Array,
  opts: { strand?: 1 | -1; anchorStart?: number; anchorEnd?: number } = {},
): LanePlacementRecord {
  const { strand = 1, anchorStart = 100, anchorEnd = 200 } = opts
  return {
    anchorRefName: 'chr1',
    anchorStart,
    anchorEnd,
    refName: laneRef,
    start: laneStart,
    end: laneEnd,
    strand,
    feature: new SimpleFeature({
      uniqueId: id,
      refName: 'chr1',
      start: anchorStart,
      end: anchorEnd,
      strand,
      alignmentOps,
      mate: { refName: laneRef, start: laneStart, end: laneEnd },
    }),
  }
}

const allMatch = (id: string, ref: string, start: number) =>
  rec(id, ref, start, start + 100, ops([100, CIGAR_EQ]))

test('two lanes that both match the anchor match each other', () => {
  const c = composeAlignmentOps(
    allMatch('u', 'Pp1', 1000),
    allMatch('l', 'Tc1', 5000),
    100,
    200,
  )!
  expect(unpack(c.ops)).toEqual([[100, CIGAR_EQ]])
  expect([c.upperStart, c.upperEnd, c.lowerStart, c.lowerEnd]).toEqual([
    1000, 1100, 5000, 5100,
  ])
})

test('a base only one lane calls a mismatch is a mismatch between the lanes', () => {
  const c = composeAlignmentOps(
    rec(
      'u',
      'Pp1',
      1000,
      1100,
      ops([40, CIGAR_EQ], [1, CIGAR_X], [59, CIGAR_EQ]),
    ),
    allMatch('l', 'Tc1', 5000),
    100,
    200,
  )!
  expect(unpack(c.ops)).toEqual([
    [40, CIGAR_EQ],
    [1, CIGAR_X],
    [59, CIGAR_EQ],
  ])
})

// the file states that each lane differs from the anchor, and nothing about
// whether they carry the same alternative — so `M`, which draws no mark
test('a base both lanes call a mismatch is left unstated between them', () => {
  const differs = ops([40, CIGAR_EQ], [1, CIGAR_X], [59, CIGAR_EQ])
  const c = composeAlignmentOps(
    rec('u', 'Pp1', 1000, 1100, differs),
    rec('l', 'Tc1', 5000, 5100, differs),
    100,
    200,
  )!
  expect(unpack(c.ops)).toEqual([
    [40, CIGAR_EQ],
    [1, CIGAR_M],
    [59, CIGAR_EQ],
  ])
})

test('a stretch only the lower lane places is the lower lane’s own insertion', () => {
  const c = composeAlignmentOps(
    rec(
      'u',
      'Pp1',
      1000,
      1090,
      ops([40, CIGAR_EQ], [10, CIGAR_D], [50, CIGAR_EQ]),
    ),
    allMatch('l', 'Tc1', 5000),
    100,
    200,
  )!
  expect(unpack(c.ops)).toEqual([
    [40, CIGAR_EQ],
    [10, CIGAR_I],
    [50, CIGAR_EQ],
  ])
  expect([c.upperEnd, c.lowerEnd]).toEqual([1090, 5100])
})

test('bases the upper lane holds that the anchor lacks are a deletion against the lower', () => {
  const c = composeAlignmentOps(
    rec(
      'u',
      'Pp1',
      1000,
      1110,
      ops([40, CIGAR_EQ], [10, CIGAR_I], [60, CIGAR_EQ]),
    ),
    allMatch('l', 'Tc1', 5000),
    100,
    200,
  )!
  expect(unpack(c.ops)).toEqual([
    [40, CIGAR_EQ],
    [10, CIGAR_D],
    [60, CIGAR_EQ],
  ])
  expect([c.upperEnd, c.lowerEnd]).toEqual([1110, 5100])
})

// the composed stretch opens 20 bp past a 10 bp deletion, so the exact walk
// puts it at 1050 where interpolating the record's overall ratio puts it at
// 1054 — the slide a composed gutter used to draw against its neighbours
test('the stretch lands where the alignment puts it, not where the ratio does', () => {
  const upper = rec(
    'u',
    'Pp1',
    1000,
    1090,
    ops([40, CIGAR_EQ], [10, CIGAR_D], [50, CIGAR_EQ]),
  )
  const c = composeAlignmentOps(upper, allMatch('l', 'Tc1', 5000), 160, 200)!
  expect(c.upperStart).toBe(1050)
  expect(unpack(c.ops)).toEqual([[40, CIGAR_EQ]])
  const ratio =
    upper.start +
    ((160 - upper.anchorStart) / (upper.anchorEnd - upper.anchorStart)) *
      (upper.end - upper.start)
  expect(ratio).toBe(1054)
})

test('a reverse upper lane hands back its ops read from the lane’s own start', () => {
  const c = composeAlignmentOps(
    rec(
      'u',
      'Pp1',
      1000,
      1100,
      ops([40, CIGAR_EQ], [1, CIGAR_X], [59, CIGAR_EQ]),
      { strand: -1 },
    ),
    allMatch('l', 'Tc1', 5000),
    100,
    200,
  )!
  expect(unpack(c.ops)).toEqual([
    [59, CIGAR_EQ],
    [1, CIGAR_X],
    [40, CIGAR_EQ],
  ])
  expect([c.upperStart, c.upperEnd]).toEqual([1000, 1100])
})

test('a coarse row declines the composition', () => {
  expect(
    composeAlignmentOps(
      rec('u', 'Pp1', 1000, 1100, ops([100, CIGAR_RUN], [100, CIGAR_EQ])),
      allMatch('l', 'Tc1', 5000),
      100,
      200,
    ),
  ).toBeUndefined()
})

test('a record with no alignment declines the composition', () => {
  expect(
    composeAlignmentOps(
      rec('u', 'Pp1', 1000, 1100, ops()),
      allMatch('l', 'Tc1', 5000),
      100,
      200,
    ),
  ).toBeUndefined()
})
