import { parseSamplesTsv } from './parseSamplesTsv.ts'

const tsv = [
  'name\tpop\tsuper_pop',
  'NA12878\tCEU\tEUR',
  'NA19240\tYRI\tAFR',
  'UNKNOWN\tXXX\tXXX',
].join('\n')

const parse = (txt: string, vcfSamples: string[]) =>
  parseSamplesTsv(txt, vcfSamples, 'samples.tsv')

test('returns rows matching VCF samples', () => {
  const { sources, warnings } = parse(tsv, ['NA12878', 'NA19240'])
  expect(sources).toEqual([
    { name: 'NA12878', pop: 'CEU', super_pop: 'EUR' },
    { name: 'NA19240', pop: 'YRI', super_pop: 'AFR' },
  ])
  // UNKNOWN was dropped, so the partial match is still reported
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toContain('UNKNOWN')
})

test('excludes metadata rows not in VCF', () => {
  expect(parse(tsv, ['NA12878']).sources.map(r => r.name)).toEqual(['NA12878'])
})

test('handles windows line endings', () => {
  const crlf = tsv.replaceAll('\n', '\r\n')
  expect(parse(crlf, ['NA12878']).sources[0]?.name).toBe('NA12878')
})

// A partial match keeps filtering, but both halves of the disagreement are
// reported rather than logged to the worker's console: the display notifies off
// these strings.
test('warns in both directions on a partial match', () => {
  const { warnings } = parse(tsv, ['NA12878', 'EXTRA'])

  expect(warnings).toHaveLength(2)
  expect(warnings[0]).toContain('2 of the 3 samples in the metadata file')
  expect(warnings[1]).toContain('1 of the 2 samples in the VCF')
  expect(warnings.every(w => w.includes('samples.tsv'))).toBe(true)
})

// The failure this exists for: point `samplesTsvLocation` at a file whose first
// column reads `1000GP_HG00096` against a VCF header naming `HG00096` and the
// filter empties. `getVcfSources` then returned [], so `sourcesBase` was [] —
// truthy, so no loading state — and the display drew an empty band with no
// banner, both warnings having gone to the worker's console. It is a config
// error, and falling back to the VCF header instead would be the worse failure:
// a track quietly showing every sample when the config asked for a subset.
test('a metadata file matching no VCF sample is an error, not an empty track', () => {
  const prefixed = ['name\tpop', '1000GP_HG00096\tGBR'].join('\n')

  expect(() => parse(prefixed, ['HG00096', 'HG00097'])).toThrow(
    /No sample in the metadata file samples\.tsv matches the VCF header/,
  )
})

// The counts alone don't say what is wrong — the prefix does, and it is only
// visible side by side.
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

// Nothing to match against, so nothing is misconfigured — a sites-only VCF has
// no samples and the empty result is the right answer.
test('does not throw when the VCF header names no samples', () => {
  expect(parse(tsv, []).sources).toEqual([])
})
