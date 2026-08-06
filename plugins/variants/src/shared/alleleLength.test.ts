import { getAlleleLength, getInsertedBp } from './alleleLength.ts'

import type { Feature } from '@jbrowse/core/util'

function feature(data: Record<string, unknown>) {
  return { get: (key: string) => data[key] } as unknown as Feature
}

test('a deletion measures its reference span', () => {
  expect(getAlleleLength(feature({ start: 100, end: 180, ALT: ['A'] }))).toBe(
    80,
  )
})

test('an insertion measures its ALT, not its 1 bp span', () => {
  expect(
    getAlleleLength(feature({ start: 100, end: 101, ALT: ['A'.repeat(64)] })),
  ).toBe(64)
})

test('a multiallelic record takes its longest allele', () => {
  expect(
    getAlleleLength(feature({ start: 100, end: 101, ALT: ['AT', 'ATTTT'] })),
  ).toBe(5)
})

test('a symbolic ALT falls through to the span getEnd resolved', () => {
  expect(
    getAlleleLength(feature({ start: 100, end: 700, ALT: ['<DEL>'] })),
  ).toBe(600)
})

test('a record with no ALT is its span', () => {
  expect(getAlleleLength(feature({ start: 10, end: 11 }))).toBe(1)
})

// Breakend mate notation is a locus, not sequence: measuring the ALT string
// reported a 14 bp insertion here (and one that grows with the contig name).
test.each(['G]chr17:198982]', '[chr17:198982[G', '.A', 'G.', 'G<DEL>'])(
  'the breakend ALT %s is not measured as sequence',
  alt => {
    const f = feature({ start: 100, end: 101, ALT: [alt] })
    expect(getAlleleLength(f)).toBe(1)
    expect(getInsertedBp(f)).toBe(0)
  },
)

// A breakend with inserted sequence still measures nothing here: the bases sit
// inside mate notation this function cannot parse, and the SV panels read the
// breakend itself.
test('a multiallelic record ignores its breakend ALT but keeps the real one', () => {
  expect(
    getAlleleLength(
      feature({ start: 100, end: 101, ALT: ['ATTTT', 'G]chr17:198982]'] }),
    ),
  ).toBe(5)
})

test('an insertion reports the bases beyond its reference span', () => {
  expect(
    getInsertedBp(feature({ start: 100, end: 101, ALT: ['A'.repeat(64)] })),
  ).toBe(63)
})

test('a deletion inserts nothing', () => {
  expect(getInsertedBp(feature({ start: 100, end: 180, ALT: ['A'] }))).toBe(0)
})
