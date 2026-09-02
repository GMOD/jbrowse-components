import { SimpleFeature } from '@jbrowse/core/util'

import { resolveAlignmentSpan } from './resolveAlignmentSpan.ts'

// A block whose two axes are the same length except for one 100bp deletion in
// the middle: past it the mate axis lags the feature axis by 100, which is the
// skew interpolating across the block cannot see.
function block({ cigar, strand = 1 }: { cigar?: string; strand?: number }) {
  return new SimpleFeature({
    uniqueId: 'x',
    refName: 'chr1',
    start: 1000,
    end: 2100,
    strand,
    ...(cigar ? { CIGAR: cigar } : {}),
    mate: {
      refName: 'ctgA',
      start: 5000,
      end: 6000,
      assemblyName: 'other',
    },
  })
}

const CIGAR = '500=100D500='

test('walks a window before the deletion straight across', () => {
  expect(
    resolveAlignmentSpan({
      alignment: block({ cigar: CIGAR }),
      window: { start: 1100, end: 1200 },
      toMate: true,
    }),
  ).toEqual({ refName: 'ctgA', start: 5100, end: 5200 })
})

test('a window past the deletion is offset by it', () => {
  // the whole point: interpolating across this block would put the answer
  // ~90bp off, and nothing on screen would say so
  expect(
    resolveAlignmentSpan({
      alignment: block({ cigar: CIGAR }),
      window: { start: 1700, end: 1800 },
      toMate: true,
    }),
  ).toEqual({ refName: 'ctgA', start: 5600, end: 5700 })
})

test('the reverse direction walks the mate axis back onto the feature', () => {
  expect(
    resolveAlignmentSpan({
      alignment: block({ cigar: CIGAR }),
      window: { start: 5600, end: 5700 },
      toMate: false,
    }),
  ).toEqual({ refName: 'chr1', start: 1700, end: 1800 })
})

test('a reverse-strand block counts down from the mate end, ends unswapped', () => {
  const span = resolveAlignmentSpan({
    alignment: block({ cigar: CIGAR, strand: -1 }),
    window: { start: 1100, end: 1200 },
    toMate: true,
  })
  expect(span).toEqual({ refName: 'ctgA', start: 5800, end: 5900 })
})

test('a reverse-strand block round-trips through both directions', () => {
  const alignment = block({ cigar: CIGAR, strand: -1 })
  const there = resolveAlignmentSpan({
    alignment,
    window: { start: 1100, end: 1200 },
    toMate: true,
  })!
  expect(
    resolveAlignmentSpan({
      alignment,
      window: { start: there.start, end: there.end },
      toMate: false,
    }),
  ).toEqual({ refName: 'chr1', start: 1100, end: 1200 })
})

test('a window wider than the block is clamped to the block', () => {
  expect(
    resolveAlignmentSpan({
      alignment: block({ cigar: CIGAR }),
      window: { start: 0, end: 999999 },
      toMate: true,
    }),
  ).toEqual({ refName: 'ctgA', start: 5000, end: 6000 })
})

// The gate, and the reason this returns undefined rather than interpolating:
// a coarse PIF tier / a minimap2 PAF without -c carries no CIGAR, and there is
// no error bound on a straight-line guess across such a block.
test('refuses a block with no CIGAR', () => {
  expect(
    resolveAlignmentSpan({
      alignment: block({}),
      window: { start: 1100, end: 1200 },
      toMate: true,
    }),
  ).toBeUndefined()
})

// The same block from the coarse tier: no CIGAR, but the fold keeps the
// deletion and writes the runs around it with their own two lengths. Walking
// that lands within the fold's gap of the CIGAR's answer, here exactly, since
// each run is genuinely linear.
function coarseBlock(coarseCigar: string) {
  return new SimpleFeature({
    uniqueId: 'c',
    refName: 'chr1',
    start: 1000,
    end: 2100,
    strand: 1,
    coarseCigar,
    mate: {
      refName: 'ctgA',
      start: 5000,
      end: 6000,
      assemblyName: 'other',
    },
  })
}

test('a coarse fold walks a window inside a run in proportion', () => {
  // the first run advances the mate 450 for 500 of the feature
  expect(
    resolveAlignmentSpan({
      alignment: coarseBlock('500:450M100D500:550M'),
      window: { start: 1100, end: 1200 },
      toMate: true,
    }),
  ).toEqual({ refName: 'ctgA', start: 5090, end: 5180 })
})

test('a coarse fold steps over its kept gap', () => {
  // past the run (450) and the deletion, 100..200 into the second run at 1.1
  expect(
    resolveAlignmentSpan({
      alignment: coarseBlock('500:450M100D500:550M'),
      window: { start: 1700, end: 1800 },
      toMate: true,
    }),
  ).toEqual({ refName: 'ctgA', start: 5560, end: 5670 })
})

test('the reverse direction walks a coarse fold too', () => {
  expect(
    resolveAlignmentSpan({
      alignment: coarseBlock('500:450M100D500:550M'),
      window: { start: 5560, end: 5670 },
      toMate: false,
    }),
  ).toEqual({ refName: 'chr1', start: 1700, end: 1800 })
})
