import PluginManager from '@gmod/jbrowse-core/PluginManager'

const pluginManager = new PluginManager()
const { stateModel: SpreadsheetView } = pluginManager.jbrequire(
  require('./SpreadsheetView'),
)

describe('Spreadsheet View mst model', () => {
  it('can instantiate with empty args', () => {
    const view = SpreadsheetView.create({ type: 'SpreadsheetView' })
    expect(view).toBeTruthy()
  })
})
