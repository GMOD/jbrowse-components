import { svSize } from './svSize.ts'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

function feat(rest: Record<string, unknown>): SimpleFeatureSerialized {
  return {
    uniqueId: 'f1',
    refName: 'chr1',
    start: 0,
    end: 1,
    ...rest,
  }
}

test('SVLEN wins, and its sign is dropped', () => {
  expect(
    svSize(feat({ start: 100, end: 1899, INFO: { SVLEN: [-1799] } })),
  ).toBe(1799)
})

test('an insertion gets its declared size, not its one-base footprint', () => {
  expect(svSize(feat({ start: 100, end: 101, INFO: { SVLEN: [2000] } }))).toBe(
    2000,
  )
})

test('a string SVLEN parses', () => {
  expect(svSize(feat({ INFO: { SVLEN: ['-42'] } }))).toBe(42)
})

test('a malformed SVLEN falls through to the endpoints rather than reading 0', () => {
  expect(svSize(feat({ start: 10, end: 60, INFO: { SVLEN: [null] } }))).toBe(50)
  expect(svSize(feat({ start: 10, end: 60, INFO: { SVLEN: [] } }))).toBe(50)
})

test('an interchromosomal breakend has no size', () => {
  expect(
    svSize(
      feat({
        refName: 'chr3',
        start: 139976413,
        end: 139976414,
        ALT: ['C]chr13:11435321]'],
      }),
    ),
  ).toBeUndefined()
})

test('an intrachromosomal breakend spans to its mate', () => {
  expect(
    svSize(
      feat({
        refName: 'chr2',
        start: 80401504,
        end: 80401505,
        ALT: ['[chr2:80401784[C'],
      }),
    ),
  ).toBe(279)
})

// `end` already carries INFO.END for a symbolic allele — VcfFeature's `getEnd`
// resolved it — so the footprint is the answer and re-deriving it from END here
// would disagree with that resolution by a base
test('a symbolic allele with no SVLEN keeps the end getEnd resolved', () => {
  expect(
    svSize(
      feat({
        refName: 'chr1',
        start: 72195287,
        end: 72215499,
        ALT: ['<DEL>'],
        INFO: { END: [72215499] },
      }),
    ),
  ).toBe(20212)
})

test('a symbolic allele naming another chromosome has no size', () => {
  expect(
    svSize(
      feat({
        refName: 'chr1',
        start: 1000,
        end: 2000,
        ALT: ['<TRA>'],
        INFO: { END: [5000], CHR2: ['chr7'] },
      }),
    ),
  ).toBeUndefined()
})

// sniffles writes one on every `<TRA>` in the SKBR3 callset, and it is the gap
// between two coordinate systems rather than a length
test('a declared SVLEN cannot give an interchromosomal record a size', () => {
  expect(
    svSize(
      feat({
        refName: '1',
        start: 564463,
        end: 564464,
        ALT: ['<TRA>'],
        INFO: { CHR2: ['MT'], END: [3916], SVLEN: [-1199826432] },
      }),
    ),
  ).toBeUndefined()
})

test('a bedpe row spans to its mate', () => {
  expect(
    svSize(
      feat({
        refName: 'chr1',
        start: 100,
        end: 200,
        mate: { refName: 'chr1', start: 5100 },
      }),
    ),
  ).toBe(5000)
})

test('a plain interval is its own length', () => {
  expect(svSize(feat({ start: 100, end: 250 }))).toBe(150)
})
