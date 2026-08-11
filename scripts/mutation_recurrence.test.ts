// mutation_recurrence.py turns the cohort VCF into the per-group percentages a
// reader reads a claim off, so every one of its counting rules is a way to
// publish a wrong number that still looks like a plot. The rules below are its
// docstring's own.
//
// The one that motivated the script is the denominator: the matrix display
// encodes a group's rate as how dark its band is, and at TP53 the 143
// triple-negative tumors carry 118 marks against the 540 HR+/HER2- tumors' 108
// -- a 4x rate difference drawn as near-equal ink. A percentage has to be per
// group size or it reproduces exactly that.
import { readFileSync } from 'node:fs'

import {
  assertPython3,
  fixture,
  runPython,
  tsvRows,
} from './pythonHelperScript.ts'

const SCRIPT = 'mutation_recurrence.py'

function vcf(samples: string[], rows: string[]) {
  return [
    '##fileformat=VCFv4.2',
    [
      '#CHROM',
      'POS',
      'ID',
      'REF',
      'ALT',
      'QUAL',
      'FILTER',
      'INFO',
      'FORMAT',
      ...samples,
    ].join('\t'),
    ...rows,
    '',
  ].join('\n')
}

/** One record, with the INFO shape maf_to_vcf.py writes. */
function record({
  chrom = 'chr1',
  pos,
  ref = 'C',
  alt = 'G',
  gene,
  impact = 'MODERATE',
  genotypes,
}: {
  chrom?: string
  pos: number
  ref?: string
  alt?: string
  gene: string
  impact?: string
  genotypes: string[]
}) {
  const csq = `${alt}|missense_variant|${impact}|${gene}|ENSG0|ENST0|protein_coding|c.1A>G|p.M1V`
  return [
    chrom,
    pos,
    '.',
    ref,
    alt,
    '.',
    'PASS',
    `AC=1;AN=2;GENE=${gene};CLASS=Missense_Mutation;CSQ=${csq}`,
    'GT:AD:DP',
    ...genotypes,
  ].join('\t')
}

function run(
  files: Record<string, string>,
  args: string[] | ((at: (name: string) => string) => string[]),
) {
  const at = fixture(files)
  const result = runPython(SCRIPT, [
    at('in.vcf'),
    at('out.bedGraph'),
    ...(typeof args === 'function' ? args(at) : args),
  ])
  if (result.status !== 0) {
    throw new Error(`${SCRIPT} exited ${result.status}: ${result.stderr}`)
  }
  return {
    ...result,
    rows: tsvRows(readFileSync(at('out.bedGraph'), 'utf8')),
  }
}

beforeAll(() => {
  assertPython3()
})

test('a tumor mutated twice in one gene counts once', () => {
  // The value is the percent of tumors carrying any mutation in the gene, not
  // the mutation count, so a gene called twice in the same tumor must not reach
  // 100% of a two-tumor cohort. TP53 has 210 records over 979 tumors -- without
  // the carrier set this reads far over its real rate.
  const { rows } = run(
    {
      'in.vcf': vcf(
        ['T1', 'T2'],
        [
          record({ pos: 100, gene: 'AAA', genotypes: ['0/1:9,9:18', '0/0'] }),
          record({ pos: 200, gene: 'AAA', genotypes: ['0/1:8,8:16', '0/0'] }),
        ],
      ),
    },
    ['--min-tumors', '1'],
  )
  expect(rows).toEqual([
    ['#chrom', 'start', 'end', 'mutated'],
    ['chr1', '99', '200', '50'],
  ])
})

test('the denominator is every tumor in the VCF, not the ones with a call', () => {
  // `0/0` is the MAF reporting no mutation here rather than a proven reference
  // base, so there is no per-site coverage mask to divide by. One carrier in
  // four tumors is 25%, never 100%.
  const { rows } = run(
    {
      'in.vcf': vcf(
        ['T1', 'T2', 'T3', 'T4'],
        [
          record({
            pos: 100,
            gene: 'AAA',
            genotypes: ['0/1', '0/0', './.', '.'],
          }),
        ],
      ),
    },
    ['--min-tumors', '1'],
  )
  expect(rows[1]).toEqual(['chr1', '99', '100', '25'])
})

test('LOW and MODIFIER calls are not hits by default, and --impact all counts them', () => {
  // The default tiers are the ones the matrix display's consequence-impact
  // coloring draws in a color rather than in grey, so the track and the cells
  // it sits over agree about what a hit is.
  const files = {
    'in.vcf': vcf(
      ['T1', 'T2'],
      [
        record({
          pos: 100,
          gene: 'AAA',
          impact: 'HIGH',
          genotypes: ['0/1', '0/0'],
        }),
        record({
          pos: 300,
          gene: 'AAA',
          impact: 'MODIFIER',
          genotypes: ['0/0', '0/1'],
        }),
      ],
    ),
  }
  const kept = run(files, ['--min-tumors', '1'])
  // only T1's HIGH call, and the span stops at the HIGH record
  expect(kept.rows[1]).toEqual(['chr1', '99', '100', '50'])
  expect(kept.stdout).toContain('1 of 2 mutations (HIGH+MODERATE)')

  const all = run(files, ['--min-tumors', '1', '--impact', 'all'])
  expect(all.rows[1]).toEqual(['chr1', '99', '300', '100'])
  expect(all.stdout).toContain('2 of 2 mutations (every call)')
})

test('an unknown impact tier is refused rather than silently matching nothing', () => {
  const at = fixture({ 'in.vcf': vcf(['T1'], []) })
  const result = runPython(SCRIPT, [
    at('in.vcf'),
    at('out.bedGraph'),
    '--impact',
    'SEVERE',
  ])
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain('unknown tier SEVERE')
})

test("a deletion's span covers the bases its REF spells, not one", () => {
  // VCF anchors a deletion on the preceding base, so REF is longer than ALT and
  // the feature covers len(REF) reference bases from POS-1. A span short by
  // that much puts the gene's bar off the deleted sequence.
  const { rows } = run(
    {
      'in.vcf': vcf(
        ['T1'],
        [
          record({
            pos: 100,
            ref: 'CGTA',
            alt: 'C',
            gene: 'AAA',
            impact: 'HIGH',
            genotypes: ['0/1'],
          }),
        ],
      ),
    },
    ['--min-tumors', '1'],
  )
  expect(rows[1]).toEqual(['chr1', '99', '103', '100'])
})

test('overlapping gene spans are clipped so the output stays a valid bedGraph', () => {
  // A bedGraph is a step function, so two genes covering the same base have no
  // defined value there. The later span is pulled forward; the percentages are
  // untouched, because a span is only ever where the calls were found.
  const { rows, stdout } = run(
    {
      'in.vcf': vcf(
        ['T1', 'T2'],
        [
          record({ pos: 100, gene: 'AAA', genotypes: ['0/1', '0/0'] }),
          record({ pos: 400, gene: 'AAA', genotypes: ['0/1', '0/0'] }),
          record({ pos: 200, gene: 'BBB', genotypes: ['0/0', '0/1'] }),
          record({ pos: 600, gene: 'BBB', genotypes: ['0/0', '0/1'] }),
        ],
      ),
    },
    ['--min-tumors', '1'],
  )
  expect(rows.slice(1)).toEqual([
    ['chr1', '99', '400', '50'],
    ['chr1', '400', '600', '50'],
  ])
  expect(stdout).toContain('1 spans clipped')
})

test('--min-tumors drops genes carried by too few tumors', () => {
  const { rows, stdout } = run(
    {
      'in.vcf': vcf(
        ['T1', 'T2', 'T3'],
        [
          record({ pos: 100, gene: 'AAA', genotypes: ['0/1', '0/1', '0/0'] }),
          record({
            chrom: 'chr2',
            pos: 100,
            gene: 'BBB',
            genotypes: ['0/1', '0/0', '0/0'],
          }),
        ],
      ),
    },
    ['--min-tumors', '2'],
  )
  expect(rows.slice(1)).toEqual([['chr1', '99', '100', '66.67']])
  expect(stdout).toContain('1 genes under --min-tumors 2')
})

test('--groups divides each group by its own size and drops small groups', () => {
  // The whole point of the script: a group's percentage is against that group,
  // so a small dense group outranks a large sparse one instead of tying it on
  // ink. `unknown` here is one tumor and is skipped rather than emitted as a
  // 0-or-100 column.
  const samples = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']
  const { rows, stdout } = run(
    {
      'in.vcf': vcf(samples, [
        record({
          pos: 100,
          gene: 'AAA',
          genotypes: ['0/1', '0/0', '0/0', '0/1', '0/1', '0/0'],
        }),
      ]),
      'clin.tsv': [
        ['name', 'subtype'].join('\t'),
        ['T1', 'lum'].join('\t'),
        ['T2', 'lum'].join('\t'),
        ['T3', 'lum'].join('\t'),
        ['T4', 'basal'].join('\t'),
        ['T5', 'basal'].join('\t'),
        ['T6', 'unknown'].join('\t'),
        '',
      ].join('\n'),
    },
    at => [
      '--min-tumors',
      '1',
      '--min-group',
      '2',
      '--groups',
      `${at('clin.tsv')}:subtype`,
    ],
  )
  // largest group first, so the columns are lum then basal
  expect(rows[0]).toEqual(['#chrom', 'start', 'end', 'lum', 'basal'])
  // 1 of 3 lum against 2 of 2 basal: the smaller, denser group outranks the
  // larger sparse one, where on ink alone it would lose 1 mark to 2
  expect(rows[1]).toEqual(['chr1', '99', '100', '33.33', '100'])
  expect(stdout).toContain('skipped small groups: unknown (1)')
})

test('a tumor the samples TSV does not name is left out of every group', () => {
  // It still counts toward the pooled tally, so the two files disagree by
  // exactly the unannotated tumors rather than by an unexplained amount.
  const { rows, stdout } = run(
    {
      'in.vcf': vcf(
        ['T1', 'T2', 'T3'],
        [record({ pos: 100, gene: 'AAA', genotypes: ['0/1', '0/1', '0/1'] })],
      ),
      'clin.tsv': [
        ['name', 'subtype'].join('\t'),
        ['T1', 'lum'].join('\t'),
        ['T2', 'lum'].join('\t'),
        '',
      ].join('\n'),
    },
    at => [
      '--min-tumors',
      '1',
      '--min-group',
      '2',
      '--groups',
      `${at('clin.tsv')}:subtype`,
    ],
  )
  expect(rows[1]).toEqual(['chr1', '99', '100', '100'])
  expect(stdout).toContain('1 samples absent from the samples TSV')
})

test('a missing --groups column is refused, naming the columns there are', () => {
  const at = fixture({
    'in.vcf': vcf(
      ['T1'],
      [record({ pos: 100, gene: 'AAA', genotypes: ['0/1'] })],
    ),
    'clin.tsv': [
      ['name', 'subtype'].join('\t'),
      ['T1', 'lum'].join('\t'),
      '',
    ].join('\n'),
  })
  const result = runPython(SCRIPT, [
    at('in.vcf'),
    at('out.bedGraph'),
    '--groups',
    `${at('clin.tsv')}:histology`,
  ])
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain("no column 'histology'")
})
