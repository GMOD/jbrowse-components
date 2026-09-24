import { getSamplesTsvSources, parseSamplesTsv } from './samplesTsv.ts'

const tsv = [
  'name\tpop\tsuper_pop',
  'NA12878\tCEU\tEUR',
  'NA19240\tYRI\tAFR',
  'UNKNOWN\tXXX\tXXX',
].join('\n')

const parse = (txt: string, names: string[] | undefined) =>
  parseSamplesTsv(txt, names, 'samples.tsv', 'the VCF')

test('returns rows matching the adapter samples', () => {
  const { sources, warnings } = parse(tsv, ['NA12878', 'NA19240'])
  expect(sources).toEqual([
    { name: 'NA12878', pop: 'CEU', super_pop: 'EUR' },
    { name: 'NA19240', pop: 'YRI', super_pop: 'AFR' },
  ])
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toContain('UNKNOWN')
})

test('excludes metadata rows the adapter does not name', () => {
  expect(parse(tsv, ['NA12878']).sources.map(r => r.name)).toEqual(['NA12878'])
})

test('handles windows line endings', () => {
  const crlf = tsv.replaceAll('\n', '\r\n')
  expect(parse(crlf, ['NA12878']).sources[0]?.name).toBe('NA12878')
})

// A sample listed twice would otherwise become two rows answering to one name,
// which every arrangement, filter and tint keyed by name then hits twice.
test('a sample listed twice keeps its first row and is reported', () => {
  const twice = `${tsv}\nNA12878\tGBR\tEUR`
  const { sources, warnings } = parse(twice, ['NA12878', 'NA19240'])
  expect(sources.map(r => [r.name, r.pop])).toEqual([
    ['NA12878', 'CEU'],
    ['NA19240', 'YRI'],
  ])
  expect(warnings[0]).toContain('1 samples appear more than once')
  expect(warnings[0]).toContain('NA12878')
})

test('warns in both directions on a partial match', () => {
  const { warnings } = parse(tsv, ['NA12878', 'EXTRA'])

  expect(warnings).toHaveLength(2)
  expect(warnings[0]).toContain('2 of the 3 samples in the metadata file')
  expect(warnings[1]).toContain('1 of the 2 samples in the VCF')
  expect(warnings.every(w => w.includes('samples.tsv'))).toBe(true)
})

// Falling back to the adapter's own samples would show every one of them when
// the config asked for a subset; an empty result draws a blank track with no
// banner.
test('a metadata file matching no adapter sample is an error, not an empty track', () => {
  const prefixed = ['name\tpop', '1000GP_HG00096\tGBR'].join('\n')

  expect(() => parse(prefixed, ['HG00096', 'HG00097'])).toThrow(
    /No sample in the metadata file samples\.tsv matches the VCF,/,
  )
})

test('the error names the file and an example of the mismatch', () => {
  const prefixed = ['name\tpop', '1000GP_HG00096\tGBR'].join('\n')

  expect(() => parse(prefixed, ['HG00096'])).toThrow(
    /"1000GP_HG00096" where the VCF names "HG00096"/,
  )
})

test('a metadata file with a header and no rows says exactly that', () => {
  expect(() => parse('name\tpop', ['HG00096'])).toThrow(
    /samples\.tsv has a header but no sample rows/,
  )
})

// A sites-only VCF names no samples, and the empty result is the right answer.
test('an adapter naming no samples gets none', () => {
  expect(parse(tsv, []).sources).toEqual([])
})

test('an adapter listing no samples of its own takes every row', () => {
  const twice = `${tsv}\nNA12878\tGBR\tEUR`
  const { sources, warnings } = parse(twice, undefined)
  expect(sources.map(r => r.name)).toEqual(['NA12878', 'NA19240', 'UNKNOWN'])
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toContain('more than once')
})

test('an unset location returns the bare names', async () => {
  expect(
    await getSamplesTsvSources({
      location: undefined,
      names: ['a', 'b'],
      namesLabel: 'the VCF',
    }),
  ).toEqual({ sources: [{ name: 'a' }, { name: 'b' }], warnings: [] })
})
