import fs from 'fs'
import path from 'path'

import { parseSTARFusionBuffer } from './STARFusionImport'
import SpreadsheetModel from '../SpreadsheetModel'

test('starfusion import', () => {
  const filepath = path.join(
    __dirname,
    '..',
    'test_data',
    'starfusion_example.fusion_predictions.tsv',
  )
  const buf = fs.readFileSync(filepath)
  const spreadsheetSnap = parseSTARFusionBuffer(buf)
  expect(spreadsheetSnap).toMatchSnapshot()

  // @ts-expect-error
  const spreadsheet = SpreadsheetModel().create(spreadsheetSnap)
  expect(spreadsheet.rowSet?.rows.length).toBe(24)
})
