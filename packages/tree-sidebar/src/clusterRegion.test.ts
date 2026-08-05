import { parseClusterRegion } from './clusterRegion.ts'

const assembly = {
  isValidRefName: (r: string) => ['chr15', '15'].includes(r),
  getCanonicalRefName2: (r: string) => (r === '15' ? 'chr15' : r),
  regions: [{ refName: 'chr15', end: 100_000_000 }],
}

test('a locstring becomes one region on the canonical refName', () => {
  expect(
    parseClusterRegion('chr15:41,440,000-41,580,000', assembly, 'dog'),
  ).toEqual([
    {
      assemblyName: 'dog',
      refName: 'chr15',
      start: 41_439_999,
      end: 41_580_000,
    },
  ])
})

test('an alias resolves, and commas are optional', () => {
  const [region] = parseClusterRegion('15:41440000-41580000', assembly, 'dog')
  expect(region?.refName).toBe('chr15')
})

test('several regions, whitespace separated', () => {
  expect(
    parseClusterRegion('chr15:1-1000 chr15:2000-3000', assembly, 'dog'),
  ).toHaveLength(2)
})

test('a bare refName is the whole contig', () => {
  expect(parseClusterRegion('chr15', assembly, 'dog')).toEqual([
    { assemblyName: 'dog', refName: 'chr15', start: 0, end: 100_000_000 },
  ])
})

test('a range past the end of the contig is clamped to it', () => {
  const [region] = parseClusterRegion(
    'chr15:99,999,000-200,000,000',
    assembly,
    'dog',
  )
  expect(region?.end).toBe(100_000_000)
})

// Both throw rather than falling back to the visible region: a typo would
// otherwise cluster over whatever happened to be on screen and look like it
// worked.
test('an unknown refName throws', () => {
  expect(() => parseClusterRegion('chrZZ:1-1000', assembly, 'dog')).toThrow()
})

test('an empty range throws', () => {
  expect(() => parseClusterRegion('chr15:500-400', assembly, 'dog')).toThrow(
    /empty clusterRegion/,
  )
})

test('a refName with no length on record throws', () => {
  expect(() =>
    parseClusterRegion('chr15', { ...assembly, regions: [] }, 'dog'),
  ).toThrow(/no length on record/)
})

// The wiggle flavor derives its sampling density from the named span rather
// than from the view's zoom, so the region list has to carry real spans for it
// to divide by. Guarding that here rather than in the wiggle plugin keeps the
// contract with its one producer.
test('regions carry the span the density is derived from', () => {
  const [region] = parseClusterRegion('chr15:1-140000', assembly, 'dog')
  expect((region?.end ?? 0) - (region?.start ?? 0)).toBe(140_000)
})
