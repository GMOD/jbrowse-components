import BED from '@gmod/bed'

import { isBedMethylFeature } from './generateBedMethylFeature.ts'
import { isRastairMethylFeature } from './generateRastairMethylFeature.ts'
import {
  bedFeatureLocus,
  bucketBedLines,
  featureData,
  makeParser,
  parseNamesFromHeader,
} from './util.ts'

// what the adapters do once they have resolved the file's column names
function withNames(columnNames: string[]) {
  return { parser: makeParser({ columnNames }), names: columnNames }
}

// a BED12 line that looks like a gene (has thickStart, blockCount, strand)
function makeTranscriptLikeInput() {
  return {
    splitLine: [
      'chr1',
      '1000',
      '2000',
      'feat1',
      '100',
      '+',
      '1100',
      '1900',
      '0',
      '3',
      '200,300,200,',
      '0,400,800,',
    ],
    refName: 'chr1',
    start: 1000,
    end: 2000,
    parser: new BED(),
    uniqueId: 'test-1',
    scoreColumn: '',
  }
}

describe('parseNamesFromHeader', () => {
  it('returns column names from a tab-separated defline', () => {
    const header = '#chrom\tstart\tend\tscore\tstrand'
    expect(parseNamesFromHeader(header)).toEqual([
      'chrom',
      'start',
      'end',
      'score',
      'strand',
    ])
  })

  it('returns undefined when header has no tabs', () => {
    expect(parseNamesFromHeader('# some non-tabular header')).toBeUndefined()
  })

  it('returns undefined for empty header', () => {
    expect(parseNamesFromHeader('')).toBeUndefined()
  })

  it('trims whitespace from column names', () => {
    const header = '# col1 \t col2 \t col3 '
    expect(parseNamesFromHeader(header)).toEqual(['col1', 'col2', 'col3'])
  })

  it('uses the last line when there are multiple header lines', () => {
    const header = '#track type=bedGraph\n#chrom\tstart\tend\tscore'
    expect(parseNamesFromHeader(header)).toEqual([
      'chrom',
      'start',
      'end',
      'score',
    ])
  })
})

// Column names matching a bigGenePred-like autoSql with an extra aggregation field
const bigGenePredNames = [
  'chrom',
  'chromStart',
  'chromEnd',
  'name',
  'score',
  'strand',
  'thickStart',
  'thickEnd',
  'reserved',
  'blockCount',
  'blockSizes',
  'chromStarts',
  'geneName2',
]

describe('makeParser', () => {
  it('types a column named like a standard BED column, and only that', () => {
    const parsed = makeParser({
      columnNames: ['chrom', 'chromStart', 'chromEnd', 'blockSizes', 'pValue'],
    }).parseLine('chr1\t1000\t2000\t200,300,\t1e-4')
    expect(parsed.chromStart).toBe(1000)
    expect(parsed.blockSizes).toEqual([200, 300])
    expect(parsed.pValue).toBe('1e-4')
  })

  it('uses the column names over a configured autoSql', () => {
    const autoSql = `table t
"d"
(
string chrom;      "Chromosome"
uint   chromStart; "Start"
uint   chromEnd;   "End"
string other;      "Other"
)`
    const parsed = makeParser({
      autoSql,
      columnNames: ['chrom', 'chromStart', 'chromEnd', 'mine'],
    }).parseLine('chr1\t1000\t2000\tx')
    expect(parsed.mine).toBe('x')
    expect(parsed.other).toBeUndefined()
  })

  it('falls back to the standard BED schema with no column names', () => {
    const parsed = makeParser({ columnNames: [] }).parseLine('chr1\t1000\t2000')
    expect(parsed).toEqual({
      chrom: 'chr1',
      chromStart: 1000,
      chromEnd: 2000,
      strand: 0,
    })
  })
})

describe('bucketBedLines', () => {
  const enc = (s: string) => new TextEncoder().encode(s)

  it('buckets data lines by refName and collects # headers', () => {
    const { header, features } = bucketBedLines(
      enc('#chrom\tstart\tend\nchr1\t1\t2\nchr1\t3\t4\nchr2\t5\t6\n'),
    )
    expect(header).toBe('#chrom\tstart\tend')
    expect(Object.keys(features)).toEqual(['chr1', 'chr2'])
    expect(features.chr1).toHaveLength(2)
  })

  it('skips track/browser directive lines rather than bucketing them', () => {
    const { features } = bucketBedLines(
      enc('browser position chr1:1-100\ntrack type=bed name=x\nchr1\t1\t2\n'),
    )
    expect(Object.keys(features)).toEqual(['chr1'])
  })
})

describe('featureData', () => {
  it('produces transcript subfeatures by default for BED12 gene-like data', () => {
    const result = featureData(makeTranscriptLikeInput())
    expect(result.type).toBe('mRNA')
    const types = result.subfeatures?.map(s => s.type)
    expect(types).toContain('CDS')
  })

  it('skips transcript heuristic when disableGeneHeuristic is true', () => {
    const result = featureData({
      ...makeTranscriptLikeInput(),
      disableGeneHeuristic: true,
    })
    expect(result.type).toBeUndefined()
    const types = result.subfeatures?.map(s => s.type)
    expect(types).not.toContain('CDS')
    expect(types).not.toContain('five_prime_UTR')
    expect(types).not.toContain('three_prime_UTR')
    // should still have block subfeatures
    expect(types).toEqual(['block', 'block', 'block'])
  })

  // These tests guarantee that extra fields like geneName2 (used as aggregateField in
  // BigBedAdapter) survive featureData through every code path. Before the refactor,
  // BigBedAdapter extracted the aggregateField from a separate parser.parseLine call;
  // now it reads it from the featureData result directly.
  it('preserves extra fields through the mRNA (UCSC transcript) path', () => {
    const result = featureData({
      splitLine: [
        'chr1',
        '1000',
        '2000',
        'EDEN.1',
        '1000',
        '+',
        '1100',
        '1900',
        '0',
        '3',
        '200,300,200,',
        '0,400,800,',
        'EDEN',
      ],
      refName: 'chr1',
      start: 1000,
      end: 2000,
      uniqueId: 'test-1',
      scoreColumn: '',
      ...withNames(bigGenePredNames),
    })
    expect(result.type).toBe('mRNA')
    expect(result.geneName2).toBe('EDEN')
  })

  it('preserves extra fields through the plain-blocks path (disableGeneHeuristic)', () => {
    const result = featureData({
      splitLine: [
        'chr1',
        '1000',
        '2000',
        'EDEN.1',
        '1000',
        '+',
        '1100',
        '1900',
        '0',
        '3',
        '200,300,200,',
        '0,400,800,',
        'EDEN',
      ],
      refName: 'chr1',
      start: 1000,
      end: 2000,
      uniqueId: 'test-2',
      scoreColumn: '',
      ...withNames(bigGenePredNames),
      disableGeneHeuristic: true,
    })
    expect(result.geneName2).toBe('EDEN')
  })

  it('arrayifies exonFrames on the column-name path so CDS phases are correct', () => {
    // two full-CDS blocks; exonFrames "0,2" → UCSC frames [0,2] → GFF phases [0,1].
    // before exonFrames was arrayified here it stayed the string "0,2", and
    // generateUcscTranscript indexed characters ('0' then ',') yielding [0,0]
    const result = featureData({
      splitLine: [
        'chr1',
        '1000',
        '2000',
        'g1',
        '0',
        '+',
        '1000',
        '2000',
        '0',
        '2',
        '500,500,',
        '0,500,',
        '0,2,',
      ],
      refName: 'chr1',
      start: 1000,
      end: 2000,
      uniqueId: 'test-ef',
      scoreColumn: '',
      ...withNames([
        'chrom',
        'chromStart',
        'chromEnd',
        'name',
        'score',
        'strand',
        'thickStart',
        'thickEnd',
        'reserved',
        'blockCount',
        'blockSizes',
        'chromStarts',
        'exonFrames',
      ]),
    })
    expect(result.type).toBe('mRNA')
    const phases = result.subfeatures
      ?.filter(f => f.type === 'CDS')
      .map(f => f.phase)
    expect(phases).toEqual([0, 1])
  })

  it('treats a "." score as missing (undefined) rather than NaN', () => {
    const result = featureData({
      splitLine: ['chr1', '1000', '2000', 'feat1', '.', '+'],
      refName: 'chr1',
      start: 1000,
      end: 2000,
      uniqueId: 'test-dot',
      scoreColumn: '',
      ...withNames([
        'chrom',
        'chromStart',
        'chromEnd',
        'name',
        'score',
        'strand',
      ]),
    })
    expect(result.score).toBeUndefined()
  })

  it('preserves extra fields when strand is 0 (unstranded, not treated as gene)', () => {
    const result = featureData({
      splitLine: [
        'chr1',
        '1000',
        '2000',
        'feat1',
        '500',
        '.',
        '1100',
        '1900',
        '0',
        '3',
        '200,300,200,',
        '0,400,800,',
        'MYGENE',
      ],
      refName: 'chr1',
      start: 1000,
      end: 2000,
      uniqueId: 'test-3',
      scoreColumn: '',
      ...withNames(bigGenePredNames),
    })
    // strand=0 means isUcscTranscript returns false
    expect(result.type).toBeUndefined()
    expect(result.geneName2).toBe('MYGENE')
  })
})

describe('bedFeatureLocus', () => {
  const splitLine = ['chr1', '1000', '2000', 'name']

  it('reads plain 0-based half-open columns', () => {
    expect(
      bedFeatureLocus({ splitLine, colRef: 0, colStart: 1, colEnd: 2 }),
    ).toEqual({ refName: 'chr1', start: 1000, end: 2000 })
  })

  it('shifts start back a base for 1-based-closed coordinates', () => {
    expect(
      bedFeatureLocus({
        splitLine,
        colRef: 0,
        colStart: 1,
        colEnd: 2,
        oneBased: true,
      }),
    ).toEqual({ refName: 'chr1', start: 999, end: 2000 })
  })

  it('emits a width-1 feature when there is no end column', () => {
    expect(
      bedFeatureLocus({
        splitLine,
        colRef: 0,
        colStart: 1,
        colEnd: 1,
        hasEndColumn: false,
      }),
    ).toEqual({ refName: 'chr1', start: 1000, end: 1001 })
  })

  it('widens a 0-based point feature (start col === end col) to width 1', () => {
    expect(
      bedFeatureLocus({ splitLine, colRef: 0, colStart: 1, colEnd: 1 }),
    ).toEqual({ refName: 'chr1', start: 1000, end: 1001 })
  })
})

describe('isBedMethylFeature', () => {
  it('returns false when col6/col7 are missing even if start and end are 0', () => {
    // guard against old `+(col6 || 0) === start` which gave true when start=0 and col6 absent
    expect(
      isBedMethylFeature({ splitLine: ['chr1', '0', '1'], start: 0, end: 1 }),
    ).toBe(false)
  })

  it('returns false for a short BED line that cannot be BedMethyl', () => {
    expect(
      isBedMethylFeature({
        splitLine: ['chr1', '100', '200', 'name', '0', '+'],
        start: 100,
        end: 200,
      }),
    ).toBe(false)
  })
})

// #chr start end name beta_est strand unmod mod no_snp snp coverage genotype
// gt_p_score gt_conf_score cpg
const rastairNames = [
  'chr',
  'start',
  'end',
  'name',
  'beta_est',
  'strand',
  'unmod',
  'mod',
  'no_snp',
  'snp',
  'coverage',
  'genotype',
  'gt_p_score',
  'gt_conf_score',
  'cpg',
]

describe('isRastairMethylFeature', () => {
  it('matches the rastair per-site methylation header columns', () => {
    expect(isRastairMethylFeature(rastairNames)).toBe(true)
  })

  it('does not match a plain BED header', () => {
    expect(isRastairMethylFeature(['chrom', 'start', 'end', 'name'])).toBe(
      false,
    )
  })
})

describe('generateRastairMethylFeature via featureData', () => {
  const splitLine = [
    'chr20',
    '100000',
    '100002',
    'CpG1',
    '0.82',
    '+',
    '3',
    '14',
    '17',
    '0',
    '17',
    'C/C',
    '20',
    '0.99',
    'REF',
  ]

  const result = featureData({
    splitLine,
    refName: 'chr20',
    start: 100000,
    end: 100002,
    uniqueId: 'r-1',
    scoreColumn: '',
    ...withNames(rastairNames),
  })

  it('scales beta_est (0-1) to a 0-100 methylation percentage', () => {
    expect(result.score).toBeCloseTo(82)
    expect(result.fraction_modified).toBeCloseTo(82)
  })

  it('maps rastair counts onto the shared bedMethyl fields', () => {
    expect(result.code).toBe('m')
    expect(result.strand).toBe(1)
    expect(result.n_mod).toBe('14')
    expect(result.n_canonical).toBe('3')
    expect(result.n_valid_cov).toBe('17')
  })
})
