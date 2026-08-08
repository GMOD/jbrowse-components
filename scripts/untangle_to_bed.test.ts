// The contract untangle_to_bed.py's own docstring calls load-bearing: every
// column of the shared per-strain BED schema is emitted in its own position,
// and the seven bubble-decomposition columns untangle cannot supply are left
// EMPTY rather than dropped, because consumers reach them positionally. Nothing
// checked that, so sliding `selfCov` into `class`'s slot -- which is the exact
// failure the docstring warns about -- would have been a silent one.
import {
  assertPython3,
  fixture,
  runPython,
  tsvRows,
} from './pythonHelperScript.ts'

// The 17 shared columns build_minigraph_paths.sh defines, then this producer's
// one addition. Spelled out here rather than read from the script, so a
// reordering has to be made twice on purpose.
const SHARED = [
  '#chrom',
  'start',
  'end',
  'name',
  'score',
  'strand',
  'thickStart',
  'thickEnd',
  'itemRgb',
  'strain',
  'class',
  'delta',
  'pathLen',
  'refLen',
  'alleles',
  'nonRef',
  'path',
]
const FORWARD_RGB = '153,153,153'
const REVERSE_RGB = '214,39,40'

// PAF: qname qlen qstart qend strand tname tlen tstart tend matches blocklen
// mapq, then tags. untangle writes 0 in the matches column and no CIGAR.
const paf = (fields: string[]) => `${fields.join('\t')}\n`

const FORWARD = paf([
  'Sakai#1#chr',
  '5498578',
  '1000',
  '2000',
  '+',
  'K12#1#chr',
  '4641652',
  '3000',
  '4000',
  '0',
  '1000',
  '255',
  'id:f:95.5',
  'sc:f:1.0',
])

const REVERSE = paf([
  'IAI39#1#chr',
  '4000000',
  '500',
  '900',
  '-',
  'K12#1#chr',
  '4641652',
  '100',
  '500',
  '0',
  '400',
  '255',
  'id:f:88',
  'sc:f:2.5',
])

function convert(pafText: string) {
  const at = fixture({ 'in.paf': pafText })
  return runPython('untangle_to_bed.py', [at('in.paf'), 'chr'])
}

beforeAll(() => {
  assertPython3()
})

test('emits the shared schema header with selfCov appended', () => {
  const rows = tsvRows(convert(FORWARD).stdout)
  expect(rows[0]).toEqual([...SHARED, 'selfCov'])
})

test('every column lands in its own slot, blanks included', () => {
  const rows = tsvRows(convert(FORWARD).stdout)
  const row = rows[1]!
  const byName = Object.fromEntries(
    rows[0]!.map((name, i) => [name, row[i]]),
  ) as Record<string, string>

  // the record is projected onto the TARGET's coordinates, since untangle
  // reports where a query lands on the reference path
  expect(byName['#chrom']).toBe('chr')
  expect(byName.start).toBe('3000')
  expect(byName.end).toBe('4000')
  // the name carries the query interval the block came from
  expect(byName.name).toBe('1,000-2,000')
  expect(byName.strand).toBe('+')
  expect(byName.thickStart).toBe('3000')
  expect(byName.thickEnd).toBe('4000')
  expect(byName.itemRgb).toBe(FORWARD_RGB)
  // PanSN sample, which is what partitionField rows the lane on
  expect(byName.strain).toBe('Sakai')
  expect(byName.selfCov).toBe('1.0')

  // The seven untangle cannot supply. Present and empty is the whole point:
  // dropping them would slide selfCov into `class` for a positional reader.
  for (const blank of [
    'class',
    'delta',
    'pathLen',
    'refLen',
    'alleles',
    'nonRef',
    'path',
  ]) {
    expect(byName[blank]).toBe('')
  }
  expect(row).toHaveLength(SHARED.length + 1)
})

test('orientation is in the color, which is why the track needs none', () => {
  const rows = tsvRows(convert(FORWARD + REVERSE).stdout)
  const colors = rows.slice(1).map(r => [r[5], r[8]])
  expect(colors).toEqual([
    ['+', FORWARD_RGB],
    ['-', REVERSE_RGB],
  ])
})

test('self-coverage above 1 survives, since it is what finds a collapsed repeat', () => {
  const rows = tsvRows(convert(REVERSE).stdout)
  // `jexl:feature.selfCov>1` in Edit filters is the documented use
  expect(rows[1]!.at(-1)).toBe('2.5')
})

test('the score is untangle’s own identity rather than a recomputed one', () => {
  const rows = tsvRows(convert(FORWARD + REVERSE).stdout)
  // BED score is 0-1000 and untangle states identity as a percent
  expect(rows.slice(1).map(r => r[4])).toEqual(['955', '880'])
})

test('two target paths are refused rather than stacked on one axis', () => {
  const other = paf([
    'Sakai#1#chr',
    '5498578',
    '10',
    '20',
    '+',
    'CFT073#1#chr',
    '5231428',
    '30',
    '40',
    '0',
    '10',
    '255',
    'id:f:90',
  ])
  const run = convert(FORWARD + other)
  // <out-refname> renames every target, so two of them would put unrelated
  // coordinates on one contig silently
  expect(run.status).not.toBe(0)
  expect(run.stderr).toMatch(/more than one target path/)
})

test('odgi’s non-PAF output fails instead of writing a header-only BED', () => {
  // Without -p, odgi untangle writes its own 10-column TSV. Every line fails
  // the field-count guard, and a header-only BED indexes and registers fine
  // while drawing an empty lane.
  const run = convert('Sakai#1#chr\t1000\t2000\tK12#1#chr\t3000\t4000\t0.9\n')
  expect(run.status).not.toBe(0)
  expect(run.stderr).toMatch(/no PAF records parsed/)
})
