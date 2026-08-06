import VcfParser from '@gmod/vcf'

import VcfFeature from '../../VcfFeature/index.ts'
import { stringifyVCF } from './vcf.ts'

const header =
  '##INFO=<ID=SOMATIC,Number=0,Type=Flag,Description="">\n' +
  '##INFO=<ID=AF,Number=A,Type=Float,Description="">\n' +
  '##INFO=<ID=END,Number=1,Type=Integer,Description="">\n' +
  '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO'

function makeFeature(line: string) {
  const parser = new VcfParser({ header })
  const variant = parser.parseLine(line)
  return new VcfFeature({ parser, variant, id: 'id1' })
}

// The data lines only — every assertion below is about a record, and the header
// is asserted on its own.
function records(...lines: string[]) {
  return stringifyVCF({ features: lines.map(makeFeature) })
    .split('\n')
    .filter(l => !l.startsWith('#'))
}

function fields(line: string) {
  return line.split('\t')
}

// Without these two lines the output is eight tab-separated columns that no VCF
// reader accepts — `bcftools view` and `tabix -p vcf` both refuse a file with no
// `##fileformat`, and this export is offered as "VCF" and saved as `.vcf`.
test('emits the fileformat and column header', () => {
  const lines = stringifyVCF({
    features: [makeFeature('chr1\t100\trs1\tA\tT\t.\tPASS\t.')],
  }).split('\n')
  expect(lines[0]).toBe('##fileformat=VCFv4.3')
  expect(lines[1]).toBe('#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO')
  // and the header names exactly the columns the records carry
  expect(fields(lines[1]!)).toHaveLength(fields(lines[2]!).length)
})

test('emits a usable header even with no features', () => {
  expect(stringifyVCF({ features: [] }).split('\n')).toEqual([
    '##fileformat=VCFv4.3',
    '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
  ])
})

test('POS is 1-based in output', () => {
  expect(fields(records('chr1\t100\trs1\tA\tT\t.\tPASS\t.')[0]!)[1]).toBe('100')
})

test('INFO flag serialized without =value', () => {
  const [line] = records('chr1\t1\t.\tA\tT\t.\tPASS\tSOMATIC')
  expect(line).toContain('\tSOMATIC')
  expect(line).not.toContain('SOMATIC=')
})

test('INFO numeric array serialized with commas', () => {
  expect(records('chr1\t1\t.\tA\tT,C\t.\tPASS\tAF=0.1,0.2')[0]).toContain(
    'AF=0.1,0.2',
  )
})

test('absent INFO outputs dot', () => {
  expect(fields(records('chr1\t1\t.\tA\tT\t.\tPASS\t.')[0]!)[7]).toBe('.')
})

test('multi-allelic ALT joined with comma', () => {
  expect(fields(records('chr1\t1\t.\tA\tT,C\t.\tPASS\t.')[0]!)[4]).toBe('T,C')
})

// FILTER is semicolon-delimited, and @gmod/vcf parses a multi-filter record into
// an array. Stringifying that array directly joined it with a comma, so a reader
// took the pair back as one filter named "q10,s50".
test('multi-value FILTER round-trips with semicolons', () => {
  expect(fields(records('chr1\t1\t.\tA\tT\t.\tq10;s50\t.')[0]!)[6]).toBe(
    'q10;s50',
  )
})

test('single and missing FILTER are unchanged', () => {
  expect(fields(records('chr1\t1\t.\tA\tT\t.\tPASS\t.')[0]!)[6]).toBe('PASS')
  expect(fields(records('chr1\t1\t.\tA\tT\t.\t.\t.')[0]!)[6]).toBe('.')
})

// `??`, not `||`: a QUAL of 0 is a real score, so it must not be written out as
// the missing-value dot.
test('a QUAL of 0 is kept rather than written as missing', () => {
  expect(fields(records('chr1\t1\t.\tA\tT\t0\tPASS\t.')[0]!)[5]).toBe('0')
})
