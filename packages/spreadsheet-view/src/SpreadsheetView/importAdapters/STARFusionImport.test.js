import { promises as fsPromises } from 'fs'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { parseSTARFusionBuffer } from './STARFusionImport'

const pluginManager = new PluginManager()
const SpreadsheetModel = pluginManager.jbrequire(
  require('../models/Spreadsheet'),
)

test('starfusion import', async () => {
  const filepath = `${process.cwd()}/packages/spreadsheet-view/src/SpreadsheetView/test_data/starfusion_example.fusion_predictions.tsv`
  const buf = await fsPromises.readFile(filepath)
  const spreadsheetSnap = await parseSTARFusionBuffer(buf, {
    selectedDatasetName: 'fogbat',
  })
  expect(spreadsheetSnap).toMatchSnapshot()
  const spreadsheet = SpreadsheetModel.create(spreadsheetSnap)
  expect(spreadsheet.rowSet.rows.length).toBe(24)
})
