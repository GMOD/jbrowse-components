import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import ThisPlugin from '.'

test('plugin in a stock JBrowse', () => {
  const pm = new PluginManager([new ThisPlugin()])
  pm.createPluggableElements()
  pm.configure()
  expect(() => pm.addPlugin(new ThisPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const NCListAdapter = pm.getAdapterType('NCListAdapter')
  const config = NCListAdapter.configSchema.create({ type: 'NCListAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot()
})

test('test creating a text search adapter', () => {
  const pm = new PluginManager([new ThisPlugin()])
  pm.createPluggableElements()
  pm.configure()

  const Adapter = pm.getTextSearchAdapterType('JBrowse1TextSearchAdapter')
  const config = Adapter.configSchema.create({
    type: 'JBrowse1TextSearchAdapter',
    textSearchAdapterId: 'JBrowse1GenerateNamesAdapterTest',
    namesIndexLocation: {
      uri: 'names/',
      locationType: 'UriLocation',
    },
    tracks: [],
    assemblies: [],
  })
  expect(getSnapshot(config)).toMatchSnapshot()
})
