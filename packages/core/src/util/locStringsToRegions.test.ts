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

// A display's `clusterRegion` is the second caller, and it depends on the span
// as well as the bounds: multi-wiggle derives its sampling density by dividing
// the named span, so a region that came back with the wrong width would bin the
// matrix wrongly rather than fail.
test('a region carries the span a density can be derived from', () => {
  const [region] = parse('ctgA:1-40000')
  expect((region?.end ?? 0) - (region?.start ?? 0)).toBe(40000)
})

test('clamps a range that runs past the end of the contig', () => {
  const [region] = parse('ctgA:49,000-60,000')
  expect(region?.end).toBe(50000)
})
