import { getAlleleLength } from './alleleLength.ts'

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
