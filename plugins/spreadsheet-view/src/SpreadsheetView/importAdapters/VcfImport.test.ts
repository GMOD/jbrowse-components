import fs from 'node:fs'
import path from 'node:path'

import { parseVcfBuffer } from './VcfImport.ts'

test('vcf file import', () => {
  const filepath = path.join(
    __dirname,
    '..',
    'test_data',
    '1801160099-N32519_26611_S51_56704.hard-filtered.vcf',
  )
  expect(parseVcfBuffer(fs.readFileSync(filepath))).toMatchSnapshot()
})

test('structural-variant VCF hoists SVTYPE ahead of REF/ALT', () => {
  const vcf = [
    '##fileformat=VCFv4.2',
    '##INFO=<ID=END,Number=1,Type=Integer,Description="End">',
    '##INFO=<ID=SVLEN,Number=1,Type=Integer,Description="Length">',
    '##INFO=<ID=SVTYPE,Number=1,Type=String,Description="Type">',
    '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
    'chr1\t100\tSV_1\tG\t<DEL>\t.\tPASS\tEND=200;SVLEN=-100;SVTYPE=DEL',
  ].join('\n')
  const { columns } = parseVcfBuffer(new TextEncoder().encode(vcf))
  const names = columns.map(c => c.name)
  // SVTYPE sits right after ID, ahead of the (potentially multi-kb) REF/ALT
  // sequence columns so it stays visible in the width-constrained grid
  expect(names.indexOf('INFO.SVTYPE')).toBe(names.indexOf('ID') + 1)
  expect(names.indexOf('INFO.SVTYPE')).toBeLessThan(names.indexOf('REF'))
  // the other INFO fields still follow after QUAL/FILTER, not hoisted
  expect(names.indexOf('INFO.END')).toBeGreaterThan(names.indexOf('FILTER'))
})
