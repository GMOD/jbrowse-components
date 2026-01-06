import VcfParser from '@gmod/vcf'

import VcfFeature from './index.ts'
import { getSOAndDescFromAltDefs } from './util.ts'

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

test('DEL feature with SVLEN when END not available', () => {
  const f = createFeature(
    'chr1\t100\trs123\tR\t<DEL>\t29\tPASS\tSVLEN=500;SVTYPE=DEL',
  )

  expect(f.get('start')).toEqual(99)
  expect(f.get('end')).toEqual(599)
})

test('INS feature with SVLEN when END not available', () => {
  const f = createFeature(
    'chr1\t100\trs123\tR\t<INS>\t29\tPASS\tSVLEN=500;SVTYPE=INS',
  )

  expect(f.get('start')).toEqual(99)
  expect(f.get('end')).toEqual(100)
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

test('getSOAndDescFromAltDefs returns correct SO term for symbolic alleles', () => {
  const parser = createParser()

  expect(getSOAndDescFromAltDefs('<DEL>', parser)).toEqual([
    'deletion',
    '<DEL>',
  ])
  expect(getSOAndDescFromAltDefs('<INS>', parser)).toEqual([
    'insertion',
    '<INS>',
  ])
  expect(getSOAndDescFromAltDefs('<DUP>', parser)).toEqual([
    'duplication',
    '<DUP>',
  ])
  expect(getSOAndDescFromAltDefs('<INV>', parser)).toEqual([
    'inversion',
    '<INV>',
  ])
  expect(getSOAndDescFromAltDefs('<CNV>', parser)).toEqual([
    'copy_number_variation',
    '<CNV>',
  ])
  expect(getSOAndDescFromAltDefs('<TRA>', parser)).toEqual([
    'translocation',
    '<TRA>',
  ])
  expect(getSOAndDescFromAltDefs('<DUP:TANDEM>', parser)).toEqual([
    'tandem_duplication',
    '<DUP:TANDEM>',
  ])
  expect(getSOAndDescFromAltDefs('<INS:ME>', parser)).toEqual([
    'insertion',
    '<INS:ME>',
  ])
  expect(getSOAndDescFromAltDefs('<UNKNOWN>', parser)).toEqual([
    'variant',
    '<UNKNOWN>',
  ])
  expect(getSOAndDescFromAltDefs('<UNKNOWN:FOO>', parser)).toEqual([
    'variant',
    '<UNKNOWN:FOO>',
  ])
})
