import { promises as fsPromises } from 'fs'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { parseCsvBuffer, dataToSpreadsheetSnapshot } from './ImportUtils'

const pluginManager = new PluginManager()
const SpreadsheetModel = pluginManager.jbrequire(require('./Spreadsheet'))

describe('import data handling utilities', () => {
  test('csv to spreadsheet snapshot', async () => {
    const filepath = `${process.cwd()}/packages/spreadsheet-view/src/SpreadsheetView/models/test_data/breast_cancer.subset.csv`
    const buf = await fsPromises.readFile(filepath)
    const rows = await parseCsvBuffer(buf)
    expect(rows[0].length).toEqual(4)
    expect(rows.length).toBe(50)

    const spreadsheetSnap = await dataToSpreadsheetSnapshot(rows)
    expect(spreadsheetSnap).toMatchSnapshot()
    const spreadsheet = SpreadsheetModel.create(spreadsheetSnap)
    expect(spreadsheet.rowSet.rows.length).toBe(50)
  })
})
