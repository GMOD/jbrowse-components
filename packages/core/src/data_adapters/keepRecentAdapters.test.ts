import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/configurationSchema.ts'
import AdapterType from '../pluggableElementTypes/AdapterType.ts'
import { BaseAdapter } from './BaseAdapter/index.ts'
import {
  cachedAdapterCount,
  clearAdapterCache,
  getAdapter,
  keepRecentAdapters,
} from './dataAdapterCache.ts'

let freed: string[] = []

class TestAdapter extends BaseAdapter {
  freeResources() {
    freed.push(this.getConf('path'))
  }
}

const pluginManager = new PluginManager()
pluginManager.addAdapterType(
  () =>
    new AdapterType({
      name: 'TestAdapter',
      configSchema: ConfigurationSchema(
        'TestAdapter',
        { path: { type: 'string', defaultValue: '' } },
        { explicitlyTyped: true },
      ),
      getAdapterClass: () => Promise.resolve(TestAdapter),
    }),
)
pluginManager.createPluggableElements()
pluginManager.configure()

const read = (path: string) =>
  getAdapter(pluginManager, 'tables', {
    type: 'TestAdapter',
    adapterId: path,
    path,
  })

beforeEach(() => {
  clearAdapterCache()
  freed = []
})

test('the least recently requested adapters are evicted and freed', async () => {
  for (const path of ['a', 'b', 'c', 'd']) {
    await read(path)
  }
  await read('a')
  await keepRecentAdapters(2)
  expect(freed).toEqual(['b', 'c'])
  expect(cachedAdapterCount()).toBe(2)
  const kept = await read('a')
  await keepRecentAdapters(2)
  expect(freed).toEqual(['b', 'c'])
  expect(await read('a')).toBe(kept)
})

test('keeping none empties the cache, and a later request builds anew', async () => {
  const first = await read('a')
  await keepRecentAdapters(0)
  expect(freed).toEqual(['a'])
  expect(cachedAdapterCount()).toBe(0)
  expect(await read('a')).not.toBe(first)
})
