import VCFParser from '@gmod/vcf'

import { variantFilterFields } from './variantFilterFields.ts'

const header = new VCFParser({
  header: [
    '##fileformat=VCFv4.2',
    '##FILTER=<ID=q10,Description="Quality below 10">',
    '##INFO=<ID=DP,Number=1,Type=Integer,Description="Total Depth">',
    '##INFO=<ID=AF,Number=A,Type=Float,Description="Allele Frequency">',
    '##INFO=<ID=DB,Number=0,Type=Flag,Description="In dbSNP">',
    '##INFO=<ID=CLNSIG,Number=.,Type=String,Description="Significance">',
    '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
  ].join('\n'),
}).getMetadata()

test('lists the columns, the INFO fields the header declares and the variant functions', async () => {
  const fields = await variantFilterFields(Promise.resolve(header))
  const info = fields.filter(f => f.group === 'INFO')
  expect(info.map(f => [f.label, f.type, f.multi])).toEqual([
    ['AF', 'number', true],
    ['CLNSIG', 'text', true],
    ['DB', 'flag', false],
    ['DP', 'number', false],
  ])
  expect(fields.some(f => f.label === 'AA')).toBe(false)
  expect(fields.find(f => f.label === 'FILTER')?.values).toEqual([
    'PASS',
    'q10',
  ])
  expect(fields.filter(f => f.group === 'Computed').map(f => f.label)).toEqual([
    'maf',
    'missingness',
    'nAlt',
    'alleleLength',
    'svType',
    'impact',
    'consequences',
  ])
})

test('falls back to the columns and functions without a header', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const fields = await variantFilterFields(Promise.reject(new Error('nope')))
  expect(fields.some(f => f.group === 'INFO')).toBe(false)
  expect(fields.some(f => f.label === 'QUAL')).toBe(true)
})
