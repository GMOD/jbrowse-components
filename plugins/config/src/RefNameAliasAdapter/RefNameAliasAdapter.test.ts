import Adapter from './RefNameAliasAdapter'
import configSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'

const pluginManager = new PluginManager()

test('adapter can fetch a simple alias file', async () => {
  const adapter = new Adapter(
    configSchema.create({
      location: {
        localPath: require.resolve('./test_data/simple_alias.txt'),
        locationType: 'LocalPathLocation',
      },
    }),
    pluginManager,
  )
  const result = await adapter.getRefNameAliases()
  expect(result[0].refName).toBe('chr1')
  expect(result[0].aliases).toEqual(['1', 'NC_000001.10'])
  expect(result[1].refName).toBe('chr2')
  expect(result[1].aliases).toEqual(['2', 'NC_000002.11'])
})
