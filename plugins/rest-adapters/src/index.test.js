import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import ThisPlugin from '.'

test('plugin in a stock JBrowse', () => {
  const originalConsoleWarn = console.warn
  console.warn = jest.fn()
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  console.warn = originalConsoleWarn
  expect(() => pluginManager.addPlugin(new ThisPlugin())).toThrow(
    /JBrowse already configured, cannot add plugins/,
  )

  const NCListAdapter = pluginManager.getAdapterType('NCListAdapter')
  const config = NCListAdapter.configSchema.create({ type: 'NCListAdapter' })
  expect(getSnapshot(config)).toMatchSnapshot()
})

test('test creating a text search adapter', () => {
  console.warn = jest.fn()
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const JB1TextSearchAdapter = pluginManager.getTextSearchAdapterType(
    'JBrowse1TextSearchAdapter',
  )
  const config = JB1TextSearchAdapter.configSchema.create({
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
