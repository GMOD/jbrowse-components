import BED from '@gmod/bed'

import { featureData2, parseNamesFromHeader } from './util.ts'

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

describe('featureData2', () => {
  it('produces transcript subfeatures by default for BED12 gene-like data', () => {
    const result = featureData2(makeTranscriptLikeInput())
    expect(result.type).toBe('mRNA')
    const types = result.subfeatures?.map(s => s.type)
    expect(types).toContain('CDS')
  })

  it('skips transcript heuristic when disableGeneHeuristic is true', () => {
    const result = featureData2({
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
  // BigBedAdapter) survive featureData2 through every code path. Before the refactor,
  // BigBedAdapter extracted the aggregateField from a separate parser.parseLine call;
  // now it reads it from the featureData2 result directly.
  it('preserves extra fields through the mRNA (UCSC transcript) path', () => {
    const result = featureData2({
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
      parser: new BED(),
      uniqueId: 'test-1',
      scoreColumn: '',
      names: bigGenePredNames,
    })
    expect(result.type).toBe('mRNA')
    expect(result['geneName2']).toBe('EDEN')
  })

  it('preserves extra fields through the plain-blocks path (disableGeneHeuristic)', () => {
    const result = featureData2({
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
      parser: new BED(),
      uniqueId: 'test-2',
      scoreColumn: '',
      names: bigGenePredNames,
      disableGeneHeuristic: true,
    })
    expect(result['geneName2']).toBe('EDEN')
  })

  it('preserves extra fields when strand is 0 (unstranded, not treated as gene)', () => {
    const result = featureData2({
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
      parser: new BED(),
      uniqueId: 'test-3',
      scoreColumn: '',
      names: bigGenePredNames,
    })
    // strand=0 means isUcscTranscript returns false
    expect(result.type).toBeUndefined()
    expect(result['geneName2']).toBe('MYGENE')
  })
})
