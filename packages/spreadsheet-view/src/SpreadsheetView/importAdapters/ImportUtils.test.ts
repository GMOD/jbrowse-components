import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { TextDecoder } from 'fastestsmallesttextencoderdecoder'
import { promises as fsPromises } from 'fs'
import path from 'path'
import { parseCsvBuffer } from './ImportUtils'

if (!window.TextDecoder) window.TextDecoder = TextDecoder

const pluginManager = new PluginManager()
const SpreadsheetModel = pluginManager.jbrequire(
  require('../models/Spreadsheet'),
)

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
  const spreadsheet = SpreadsheetModel.create(spreadsheetSnap)
  expect(spreadsheet.rowSet.rows.length).toBe(49)
})
