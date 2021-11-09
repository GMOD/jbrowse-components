import { promises as fsPromises } from 'fs'
import path from 'path'
import { parseCsvBuffer } from './ImportUtils'

import { TextDecoder } from 'web-encoding'
import SpreadsheetModel from '../models/Spreadsheet'
window.TextDecoder = TextDecoder

test('csv to spreadsheet snapshot', async () => {
  const filepath = path.join(
    __dirname,
    '..',
    'test_data',
    'breast_cancer.subset.csv',
  )
  const buf = await fsPromises.readFile(filepath)
  const spreadsheetSnap = await parseCsvBuffer(buf, {
    hasColumnNameLine: true,
    columnNameLineNumber: 1,
    isValidRefName: () => true,
  })
  expect(spreadsheetSnap).toMatchSnapshot()
  // @ts-ignore
  const spreadsheet = SpreadsheetModel.create(spreadsheetSnap)
  expect(spreadsheet.rowSet.rows.length).toBe(49)
})
