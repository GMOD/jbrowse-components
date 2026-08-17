import { clampToContig } from './clampToContig.ts'

import type { Assembly } from '../assemblyManager/assembly.ts'

const CONTIGS = [{ refName: 'ctgA', start: 0, end: 100 }]

const assembly = {
  name: 'volvox',
  getCanonicalRefName2: (r: string) => (r === 'contigA' ? 'ctgA' : r),
  getRegionForRefName: (r: string) => CONTIGS.find(c => c.refName === r),
} as unknown as Assembly

test('leaves a span already inside the contig alone', () => {
  expect(
    clampToContig(assembly, { refName: 'ctgA', start: 10, end: 90 }),
  ).toEqual({ assemblyName: 'volvox', refName: 'ctgA', start: 10, end: 90 })
})

test('clamps both ends, and canonicalizes the refName on the way', () => {
  expect(
    clampToContig(assembly, { refName: 'contigA', start: -50, end: 150 }),
  ).toEqual({ assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 })
})

// The whole reason this is a function: the one-sided version returns end < start
// here, and every consumer that sums region lengths then subtracts.
test('drops a span wholly past the contig end rather than inverting it', () => {
  expect(
    clampToContig(assembly, { refName: 'ctgA', start: 500, end: 600 }),
  ).toBeUndefined()
})

test('drops a span that ends exactly where the contig starts', () => {
  // half-open, so [-10, 0) covers no base of the contig
  expect(
    clampToContig(assembly, { refName: 'ctgA', start: -10, end: 0 }),
  ).toBeUndefined()
})

test('floors at 0 even with no contig to clamp against, and keeps the span', () => {
  // regions still loading, or a refName this assembly doesn't have: interbase has
  // no coordinate below 0 whatever the contig turns out to be, and with no high
  // bound there is nothing that could invert
  expect(
    clampToContig(assembly, { refName: 'unknown', start: -50, end: 150 }),
  ).toEqual({ assemblyName: 'volvox', refName: 'unknown', start: 0, end: 150 })
})

test('carries the caller’s extra fields through', () => {
  expect(
    clampToContig(assembly, {
      refName: 'ctgA',
      start: 10,
      end: 90,
      reversed: true,
    } as never),
  ).toMatchObject({ reversed: true })
})
