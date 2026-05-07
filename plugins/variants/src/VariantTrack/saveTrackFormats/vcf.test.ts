import VcfParser from '@gmod/vcf'

import { stringifyVCF } from './vcf.ts'
import VcfFeature from '../../VcfFeature/index.ts'

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

test('POS is 1-based in output', () => {
  const f = makeFeature('chr1\t100\trs1\tA\tT\t.\tPASS\t.')
  const out = stringifyVCF({ features: [f] })
  const fields = out.split('\t')
  expect(fields[1]).toBe('100')
})

test('INFO flag serialized without =value', () => {
  const f = makeFeature('chr1\t1\t.\tA\tT\t.\tPASS\tSOMATIC')
  const out = stringifyVCF({ features: [f] })
  expect(out).toContain('\tSOMATIC')
  expect(out).not.toContain('SOMATIC=')
})

test('INFO numeric array serialized with commas', () => {
  const f = makeFeature('chr1\t1\t.\tA\tT,C\t.\tPASS\tAF=0.1,0.2')
  const out = stringifyVCF({ features: [f] })
  expect(out).toContain('AF=0.1,0.2')
})

test('absent INFO outputs dot', () => {
  const f = makeFeature('chr1\t1\t.\tA\tT\t.\tPASS\t.')
  const out = stringifyVCF({ features: [f] })
  const fields = out.split('\t')
  expect(fields[7]).toBe('.')
})

test('multi-allelic ALT joined with comma', () => {
  const f = makeFeature('chr1\t1\t.\tA\tT,C\t.\tPASS\t.')
  const out = stringifyVCF({ features: [f] })
  const fields = out.split('\t')
  expect(fields[4]).toBe('T,C')
})
