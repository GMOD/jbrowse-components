import PluginManager from '@jbrowse/core/PluginManager'
import { promises as fsPromises } from 'fs'
import path from 'path'
import { parseSTARFusionBuffer } from './STARFusionImport'
import { TextDecoder } from 'web-encoding'
window.TextDecoder = TextDecoder

const pluginManager = new PluginManager()
const SpreadsheetModel = pluginManager.jbrequire(
  require('../models/Spreadsheet'),
)

test('starfusion import', async () => {
  const filepath = path.join(
    __dirname,
    '..',
    'test_data',
    'starfusion_example.fusion_predictions.tsv',
  )
  const buf = await fsPromises.readFile(filepath)
  const spreadsheetSnap = await parseSTARFusionBuffer(buf, {
    selectedAssemblyName: 'fogbat',
    isValidRefName() {
      return true
    },
  })
  expect(spreadsheetSnap).toMatchSnapshot()
  const spreadsheet = SpreadsheetModel.create(spreadsheetSnap)
  expect(spreadsheet.rowSet.rows.length).toBe(24)
})
