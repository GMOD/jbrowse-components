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
  const { columns, rowSet } = parseVcfBuffer(fs.readFileSync(filepath))

  // The column list is what this module decides — which INFO fields become
  // columns, in what order, and where SVTYPE lands. The two tests below probe
  // it directly; this pins the whole thing on a real file.
  expect(columns).toMatchSnapshot()

  // `cellData` is the other half it decides, and one line per row covers every
  // cell in the file. `feature` is not this module's output — it is
  // `VcfFeature.toJSON()` passed through from @jbrowse/plugin-variants, which
  // is where its 148 lines per row belong — so one row carries it in full
  // rather than all 101 restating the same pass-through.
  expect(rowSet.rows.length).toBe(101)
  expect(rowSet.rows.map(r => JSON.stringify(r.cellData))).toMatchSnapshot()
  expect(rowSet.rows[0]).toMatchSnapshot()
})

// Regression: `.` is how VCF spells "no INFO here", and splitting it produced a
// nameless key — a phantom `INFO..` flag column, true in every row, that no
// file declared and no filter could mean anything against
test('a sites-only VCF gets neither a phantom INFO column nor a FORMAT one', () => {
  const vcf = [
    '##fileformat=VCFv4.2',
    '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
    'chr1\t100\trs1\tG\tA\t50\tPASS\t.',
    'chr1\t200\trs2\tC\tT\t60\tPASS\tDP=14;',
  ].join('\n')
  const { columns, rowSet } = parseVcfBuffer(new TextEncoder().encode(vcf))
  const names = columns.map(c => c.name)
  expect(names).toEqual([
    'CHROM',
    'POS',
    'ID',
    'REF',
    'ALT',
    'QUAL',
    'FILTER',
    'INFO.DP',
  ])
  expect(rowSet.rows[0]!.cellData).not.toHaveProperty('INFO..')
  // the trailing `;` on the second row is the same nameless key by another
  // spelling, and its real field still parses
  expect(rowSet.rows[1]!.cellData).toMatchObject({ 'INFO.DP': 14 })
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
