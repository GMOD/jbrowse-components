import { createTestSession } from '@jbrowse/web/src/rootModel'

describe('PluginStoreModel', () => {
  it('filters plugins correctly', () => {
    const session = createTestSession()
    const model = session.addWidget('PluginStoreWidget', 'pluginStoreWidget')

    model.setFilterText('Foo')
    expect(model.filterText).toEqual('Foo')

    model.clearFilterText()
    expect(model.filterText).toEqual('')
  })
})
