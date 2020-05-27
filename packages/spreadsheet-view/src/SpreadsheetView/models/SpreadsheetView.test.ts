import PluginManager from '@gmod/jbrowse-core/PluginManager'
import SpreadsheetViewF from './SpreadsheetView'

const pluginManager = new PluginManager()
const SpreadsheetView = pluginManager.load(SpreadsheetViewF)

describe('Spreadsheet View mst model', () => {
  it('can instantiate with empty args', () => {
    const view = SpreadsheetView.create({ type: 'SpreadsheetView' })
    expect(view).toBeTruthy()
  })
})
