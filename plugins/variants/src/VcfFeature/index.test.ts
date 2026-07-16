import VcfParser from '@gmod/vcf'

import VcfFeature from './index.ts'
import {
  getMinimalDesc,
  getSOTermAndDescription,
  makeSimpleAltString,
} from './util.ts'

const defaultHeader =
  '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSAMPLE'

function createFeature(line: string) {
  const parser = new VcfParser({ header: defaultHeader })
  const variant = parser.parseLine(line)
  return new VcfFeature({ parser, variant, id: 'testid' })
}

function createParser() {
  return new VcfParser({ header: defaultHeader })
}

test('test usage of the VcfFeature', () => {
  const parser = new VcfParser({
    header:
      '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tBAMs/caudaus.sorted.sam',
  })
  const line =
    'lcl|Scaffald_1\t80465\trs118266897\tR\tA\t29\tPASS\tNS=3;0,14;AF=0.5;DB;112;PG2.1'
  const variant = parser.parseLine(line)
  const f = new VcfFeature({ parser, variant, id: 'myuniqueid' })

  expect(f.id()).toEqual('myuniqueid')
  expect(f.get('name')).toEqual('rs118266897')
})

test('INS feature with END less than start', () => {
  const f = createFeature('chr1\t100\trs123\tR\tA\t29\tPASS\tEND=1;SVTYPE=INS')

  expect(f.get('start')).toEqual(99)
  expect(f.get('end')).toEqual(100)
})

test('DEL feature with END info field', () => {
  const f = createFeature(
    'chr1\t100\trs123\tR\t<DEL>\t29\tPASS\tEND=1000;SVTYPE=DEL',
  )

  expect(f.get('start')).toEqual(99)
  expect(f.get('end')).toEqual(1000)
  expect(f.get('description')).toEqual('<DEL>')
})

test('TRA feature with CHR2 and END info', () => {
  const f = createFeature(
    'chr1\t100\trs123\tR\t<TRA>\t29\tPASS\tCHR2=chr8;END=45000;SVTYPE=TRA',
  )

  expect(f.get('start')).toEqual(99)
  expect(f.get('description')).toEqual('<TRA> chr8:45,000')
  expect(f.get('type')).toEqual('translocation')
})

test('TRA feature without CHR2/END info', () => {
  const f = createFeature('chr1\t100\trs123\tR\t<TRA>\t29\tPASS\tSVTYPE=TRA')

  expect(f.get('start')).toEqual(99)
  expect(f.get('description')).toEqual('<TRA>')
  expect(f.get('type')).toEqual('translocation')
})

test('DEL feature with SVLEN when END not available', () => {
  const f = createFeature(
    'chr1\t100\trs123\tR\t<DEL>\t29\tPASS\tSVLEN=500;SVTYPE=DEL',
  )

  expect(f.get('start')).toEqual(99)
  expect(f.get('end')).toEqual(599)
  expect(f.get('description')).toEqual('<DEL> 500bp')
})

test('DUP feature with SVLEN shows size', () => {
  const f = createFeature(
    'chr1\t100\trs123\tR\t<DUP>\t29\tPASS\tSVLEN=1000;SVTYPE=DUP',
  )

  expect(f.get('description')).toEqual('<DUP> 1Kbp')
})

test('INS feature with SVLEN when END not available', () => {
  const f = createFeature(
    'chr1\t100\trs123\tR\t<INS>\t29\tPASS\tSVLEN=500;SVTYPE=INS',
  )

  expect(f.get('start')).toEqual(99)
  expect(f.get('end')).toEqual(100)
  expect(f.get('description')).toEqual('<INS> 500bp')
})

test('DEL with missing SVLEN falls back to REF length instead of NaN end', () => {
  const f = createFeature(
    'chr1\t100\trs123\tR\t<DEL>\t29\tPASS\tSVLEN=.;SVTYPE=DEL',
  )

  expect(f.get('start')).toEqual(99)
  expect(f.get('end')).toEqual(100)
})

test('DEL with missing END falls back to SVLEN', () => {
  const f = createFeature(
    'chr1\t100\trs123\tR\t<DEL>\t29\tPASS\tEND=.;SVLEN=500;SVTYPE=DEL',
  )

  expect(f.get('end')).toEqual(599)
})

test('multiple SVs', () => {
  const f = createFeature(
    'chr1\t100\trs123\tR\t<INVDUP>,<INV>\t29\tPASS\tEND=1000;SVTYPE=DEL',
  )

  expect(f.get('description')).toEqual('<INVDUP>,<INV>')
})

test('BND', () => {
  const f = createFeature(
    'chr1\t100\trs123\tR\tG[ctgA:34200[\t29\tPASS\tEND=1000;SVTYPE=BND',
  )

  expect(f.get('description')).toEqual('G[ctgA:34200[')
})

test('multiple BND', () => {
  const f = createFeature(
    'chr1\t100\trs123\tR\tG[ctgA:34200[,G[ctgA:44200[\t29\tPASS\tEND=1000;SVTYPE=BND',
  )

  expect(f.get('description')).toEqual('G[ctgA:34200[,G[ctgA:44200[')
})

test('multiple SNV', () => {
  const f = createFeature('chr1\t100\trs123\tG\tA,C\t29\tPASS\t.')

  expect(f.get('description')).toEqual('G -> A,C')
})

test('insertion with symbolic allele', () => {
  const f = createFeature('chr1\t100\trs123\tG\tAT,<*>\t29\tPASS\t.')

  expect(f.get('description')).toEqual('G -> AT,<*>')
})

test('mixed deletion and insertion', () => {
  const f = createFeature('chr1\t100\trs123\tATC\tT,ATCGGGG\t29\tPASS\t.')

  expect(f.get('description')).toEqual('ATC -> T,ATCGGGG')
})

test('mixed symbolic and SNV', () => {
  const f = createFeature('chr1\t100\trs123\tG\tA,T,<DEL>\t29\tPASS\t.')

  expect(f.get('description')).toEqual('G -> A,T,<DEL>')
})

test('multiple symbolic ALT', () => {
  const f = createFeature('chr1\t100\trs123\tG\t<DEL>,<INS>,<DUP>\t29\tPASS\t.')

  expect(f.get('description')).toEqual('<DEL>,<INS>,<DUP>')
})

test('multiple insertions of varying lengths', () => {
  const f = createFeature(
    'chr1\t100\trs123\tA\tAA,AAA,AAAA,AAAAA,AAAAAA\t29\tPASS\t.',
  )

  expect(f.get('description')).toMatchSnapshot()
})

// VCF 4.3 spec example 1.1: . in ALT field indicates monomorphic reference
test('null ALT', () => {
  const f = createFeature('chr1\t100\trs123\tG\t.\t29\tPASS\t.')

  expect(f.toJSON()).toMatchSnapshot()
})

test('getSOTermAndDescription returns correct SO term for symbolic alleles', () => {
  const parser = createParser()
  const soTerm = (alt: string) => getSOTermAndDescription('N', [alt], parser)[0]

  expect(soTerm('<DEL>')).toBe('deletion')
  expect(soTerm('<INS>')).toBe('insertion')
  expect(soTerm('<DUP>')).toBe('duplication')
  expect(soTerm('<INV>')).toBe('inversion')
  expect(soTerm('<CNV>')).toBe('copy_number_variation')
  expect(soTerm('<TRA>')).toBe('translocation')
  expect(soTerm('<DUP:TANDEM>')).toBe('tandem_duplication')
  expect(soTerm('<INS:ME>')).toBe('insertion')
  expect(soTerm('<UNKNOWN>')).toBe('variant')
  expect(soTerm('<UNKNOWN:FOO>')).toBe('variant')
})

test('getSOTermAndDescription maps integer copy-number alleles', () => {
  const parser = createParser()
  const soTerm = (alt: string) => getSOTermAndDescription('N', [alt], parser)[0]

  expect(soTerm('<CN0>')).toBe('copy_number_variation')
  expect(soTerm('<CN3>')).toBe('copy_number_variation')
  expect(soTerm('<CN12>')).toBe('copy_number_variation')
})

test('getMinimalDesc - SNV returns just alt', () => {
  expect(getMinimalDesc('A', 'T')).toEqual('T')
})

test('getMinimalDesc - short indel shows bases', () => {
  expect(getMinimalDesc('ACGT', 'A')).toEqual('ACGT -> A')
})

test('getMinimalDesc - mid-length allele under threshold still shows bases', () => {
  expect(getMinimalDesc('ACGTACGT', 'A')).toEqual('ACGTACGT -> A')
})

test('getMinimalDesc - long indel shows bp counts per side', () => {
  expect(getMinimalDesc('ACGTACGTACGT', 'A')).toEqual('12bp -> A')
  expect(getMinimalDesc('ACGTACGTACGT', 'ACGTACGTACGT')).toEqual('12bp -> 12bp')
})

test('getMinimalDesc - symbolic returns alt as-is', () => {
  expect(getMinimalDesc('A', '<DEL>')).toEqual('<DEL>')
})

test('makeSimpleAltString - phased heterozygous', () => {
  expect(makeSimpleAltString('0|1', 'A', ['T'])).toEqual('ref(A)|T')
})

test('makeSimpleAltString - unphased ref/ref', () => {
  expect(makeSimpleAltString('0/0', 'A', ['T'])).toEqual('ref(A)/ref(A)')
})

test('makeSimpleAltString - missing allele', () => {
  expect(makeSimpleAltString('./1', 'A', ['T'])).toEqual('./T')
})

test('makeSimpleAltString - multi-allelic', () => {
  expect(makeSimpleAltString('1/2', 'A', ['T', 'G'])).toEqual('T/G')
})

test('makeSimpleAltString - ref/alt under threshold consistently shown as bases', () => {
  expect(makeSimpleAltString('0/1', 'ACGTACGT', ['T'])).toEqual(
    'ref(ACGTACGT)/ACGTACGT -> T',
  )
})

test('makeSimpleAltString - long ref shown as bp count on both sides', () => {
  expect(makeSimpleAltString('0/1', 'ACGTACGTACGT', ['T'])).toEqual(
    'ref(12bp)/12bp -> T',
  )
})

test('makeSimpleAltString - ref 10+ chars shown as bp count', () => {
  expect(makeSimpleAltString('0/0', 'ACGTACGTAC', [])).toEqual(
    'ref(10bp)/ref(10bp)',
  )
})
