import { parseCigar2Typed } from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import { buildCigarMap } from '../LinearSyntenyRPC/buildCigarMap.ts'
import { resolveAlignmentSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import { cigarMapSpan } from './cigarMapSpan.ts'

import type { FeatPos } from '../LinearSyntenyDisplay/model.ts'
import type { SyntenyCigarMapResult } from '../LinearSyntenyRPC/SyntenyGetCigarMap.ts'

const FEAT = {
  start: 1000,
  end: 2100,
  mate: { start: 5000, end: 6000, refName: 'ctgA', assemblyName: 'other' },
  refName: 'chr1',
  assemblyName: 'one',
  id: 'x',
  name: '',
  attributes: {},
}

function feat(strand = 1): FeatPos {
  return { ...FEAT, strand }
}

function alignment(cigar: string, strand = 1) {
  return new SimpleFeature({
    uniqueId: 'x',
    refName: FEAT.refName,
    start: FEAT.start,
    end: FEAT.end,
    strand,
    CIGAR: cigar,
    mate: FEAT.mate,
  })
}

function mapFor(cigar: string, strand = 1): SyntenyCigarMapResult {
  return {
    ...buildCigarMap(parseCigar2Typed(cigar)),
    start: FEAT.start,
    end: FEAT.end,
    mateStart: FEAT.mate.start,
    mateEnd: FEAT.mate.end,
    strand,
  }
}

const CIGAR = '500=100D500='

// The map exists to give the frame pass the answer the settle would give, so the
// walk is the oracle rather than a second set of hand-written numbers.
function bothAgree(cigar: string, strand: number, toMate: boolean) {
  const map = mapFor(cigar, strand)
  const f = feat(strand)
  const [lo, hi] = toMate ? [f.start, f.end] : [f.mate.start, f.mate.end]
  for (let start = lo; start + 100 <= hi; start += 37) {
    const window = { refName: 'w', start, end: start + 100 }
    const walked = resolveAlignmentSpan({
      alignment: alignment(cigar, strand),
      window,
      toMate,
    })!
    const mapped = cigarMapSpan({ feat: f, map, window, toMate })!
    expect(mapped.refName).toBe(walked.refName)
    // the walk floors and ceils, the map is fractional
    expect(mapped.start).toBeGreaterThanOrEqual(walked.start)
    expect(mapped.start).toBeLessThanOrEqual(walked.start + 1)
    expect(mapped.end).toBeGreaterThanOrEqual(walked.end - 1)
    expect(mapped.end).toBeLessThanOrEqual(walked.end)
  }
}

test('agrees with the walk mapping onto the mate axis', () => {
  bothAgree(CIGAR, 1, true)
})

test('agrees with the walk mapping onto the feature axis', () => {
  bothAgree(CIGAR, 1, false)
})

test('agrees with the walk on a reverse-strand block, both directions', () => {
  bothAgree(CIGAR, -1, true)
  bothAgree(CIGAR, -1, false)
})

test('agrees with the walk over a CIGAR with indels both ways', () => {
  bothAgree('200=50I300=100D250=30I200=', 1, true)
  bothAgree('200=50I300=100D250=30I200=', 1, false)
})

test('a window past the deletion is offset by it, not interpolated across', () => {
  expect(
    cigarMapSpan({
      feat: feat(),
      map: mapFor(CIGAR),
      window: { refName: 'chr1', start: 1700, end: 1800 },
      toMate: true,
    }),
  ).toEqual({ refName: 'ctgA', start: 5600, end: 5700 })
})

test('a window edge landing on an insertion keeps the offset before it', () => {
  // '500=100I500=' puts a 100bp insertion at feature offset 500. The half-open
  // rule says a window edge exactly there has not crossed it.
  expect(
    cigarMapSpan({
      feat: feat(),
      map: mapFor('500=100I500='),
      window: { refName: 'chr1', start: 1400, end: 1500 },
      toMate: true,
    }),
  ).toEqual({ refName: 'ctgA', start: 5400, end: 5500 })
})

test('a window wider than the block lands on the block, not past it', () => {
  expect(
    cigarMapSpan({
      feat: feat(),
      map: mapFor(CIGAR),
      window: { refName: 'chr1', start: 0, end: 1e9 },
      toMate: true,
    }),
  ).toEqual({ refName: 'ctgA', start: 5000, end: 6000 })
})

test('a map for another block is refused rather than read off the wrong start', () => {
  const stale = { ...mapFor(CIGAR), start: 9000 }
  expect(
    cigarMapSpan({
      feat: feat(),
      map: stale,
      window: { refName: 'chr1', start: 1700, end: 1800 },
      toMate: true,
    }),
  ).toBeUndefined()
})

test('a map whose strand disagrees is refused too', () => {
  expect(
    cigarMapSpan({
      feat: feat(1),
      map: mapFor(CIGAR, -1),
      window: { refName: 'chr1', start: 1700, end: 1800 },
      toMate: true,
    }),
  ).toBeUndefined()
})

test('a window collapsing onto one coordinate is no answer', () => {
  expect(
    cigarMapSpan({
      feat: feat(),
      map: mapFor(CIGAR),
      window: { refName: 'chr1', start: 1700, end: 1700 },
      toMate: true,
    }),
  ).toBeUndefined()
})
