import { promises as fsPromises } from 'fs'
import path from 'path'

// locals
import { parseCsvBuffer } from './ImportUtils'
import SpreadsheetModel from '../models/Spreadsheet'

test('csv to spreadsheet snapshot', async () => {
  const filepath = path.join(
    __dirname,
    '..',
    'test_data',
    'breast_cancer.subset.csv',
  )
  const buf = await fsPromises.readFile(filepath)
  const spreadsheetSnap = await parseCsvBuffer(buf, {
    columnNameLineNumber: 1,
    hasColumnNameLine: true,
    isValidRefName: () => true,
  })
  expect(spreadsheetSnap).toMatchSnapshot()
  // @ts-expect-error
  const spreadsheet = SpreadsheetModel.create(spreadsheetSnap)
  expect(spreadsheet.rowSet.rows.length).toBe(49)
})
