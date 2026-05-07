import { parseSamplesTsv } from './parseSamplesTsv.ts'

// Tests deliberately use mismatched sample sets; silence the expected warnings
beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}))
afterEach(() => jest.restoreAllMocks())

const tsv = [
  'name\tpop\tsuper_pop',
  'NA12878\tCEU\tEUR',
  'NA19240\tYRI\tAFR',
  'UNKNOWN\tXXX\tXXX',
].join('\n')

test('returns rows matching VCF samples', () => {
  const result = parseSamplesTsv(tsv, ['NA12878', 'NA19240'])
  expect(result).toEqual([
    { name: 'NA12878', pop: 'CEU', super_pop: 'EUR' },
    { name: 'NA19240', pop: 'YRI', super_pop: 'AFR' },
  ])
})

test('excludes metadata rows not in VCF', () => {
  const result = parseSamplesTsv(tsv, ['NA12878'])
  expect(result.map(r => r.name)).toEqual(['NA12878'])
})

test('returns empty array when no matches', () => {
  expect(parseSamplesTsv(tsv, ['NOTHERE'])).toEqual([])
})

test('handles windows line endings', () => {
  const crlf = tsv.replaceAll('\n', '\r\n')
  const result = parseSamplesTsv(crlf, ['NA12878'])
  expect(result[0]?.name).toBe('NA12878')
})
