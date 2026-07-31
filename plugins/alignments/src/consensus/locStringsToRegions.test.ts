import { locStringsToRegions } from './locStringsToRegions.ts'

import type { RefNameSource } from './locStringsToRegions.ts'

// ctgA is 50kb; ctgB is known as a refName but has no length on record, which is
// what separates "we can't size this contig" from "you typed an empty range".
const assembly: RefNameSource = {
  isValidRefName: refName => ['ctgA', 'ctgB', 'contigA'].includes(refName),
  getCanonicalRefName2: refName => (refName === 'contigA' ? 'ctgA' : refName),
  regions: [{ refName: 'ctgA', end: 50000 }],
}

function parse(locStrings: string) {
  return locStringsToRegions(locStrings, assembly, 'volvox')
}

test('parses a single region to a half-open interval', () => {
  expect(parse('ctgA:101-200')).toEqual([
    { assemblyName: 'volvox', refName: 'ctgA', start: 100, end: 200 },
  ])
})

// the rubberband selection round-trips through the field as whitespace-separated
// locstrings, so a multi-region selection has to come back out as one
test('splits whitespace-separated regions', () => {
  expect(parse('  ctgA:101-200   ctgA:1001-1100 ')).toEqual([
    { assemblyName: 'volvox', refName: 'ctgA', start: 100, end: 200 },
    { assemblyName: 'volvox', refName: 'ctgA', start: 1000, end: 1100 },
  ])
})

test('a bare refName is the whole contig', () => {
  expect(parse('ctgA')).toEqual([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50000 },
  ])
})

test('resolves an alias to the canonical refName', () => {
  expect(parse('contigA:1-10')).toEqual([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10 },
  ])
})

test('clamps a range running past the end of the contig', () => {
  expect(parse('ctgA:49,001-60,000')).toEqual([
    { assemblyName: 'volvox', refName: 'ctgA', start: 49000, end: 50000 },
  ])
})

test('rejects an unparsable refName', () => {
  expect(() => parse('nope:1-10')).toThrow()
})

// distinct from the empty-range message: nothing is wrong with what was typed
test('rejects a refName with no length on record', () => {
  expect(() => parse('ctgB:1-10')).toThrow(/no length on record/)
})

test('rejects an empty range', () => {
  expect(() => parse('ctgA:200-100')).toThrow(/empty region/)
})
