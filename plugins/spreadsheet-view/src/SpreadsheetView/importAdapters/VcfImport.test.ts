import { promises as fsPromises } from 'fs'
import path from 'path'

import { parseVcfBuffer } from './VcfImport'
import SpreadsheetModel from '../SpreadsheetModel'

test('vcf file import', async () => {
  const filepath = path.join(
    __dirname,
    '..',
    'test_data',
    '1801160099-N32519_26611_S51_56704.hard-filtered.vcf',
  )
  const buf = await fsPromises.readFile(filepath)
  const spreadsheetSnap = parseVcfBuffer(buf)
  expect(spreadsheetSnap).toMatchSnapshot()

  // @ts-expect-error
  const spreadsheet = SpreadsheetModel().create(spreadsheetSnap)
  expect(spreadsheet.rowSet?.rows.length).toBe(101)
})
