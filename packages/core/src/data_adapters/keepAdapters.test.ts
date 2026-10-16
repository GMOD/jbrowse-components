import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/configurationSchema.ts'
import AdapterType from '../pluggableElementTypes/AdapterType.ts'
import { BaseAdapter } from './BaseAdapter/index.ts'
import {
  adapterRequests,
  cachedAdapterCount,
  clearAdapterCache,
  getAdapter,
  keepAdapters,
} from './dataAdapterCache.ts'

import type { AnyDataAdapter } from './BaseAdapter/index.ts'

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

const pathOf = (adapter: AnyDataAdapter) => adapter.getConf('path') as string

test('keep sees the adapters most recently requested first, and evicts and frees what it declines', async () => {
  for (const path of ['a', 'b', 'c', 'd']) {
    await read(path)
  }
  await read('a')
  const seen: string[] = []
  await keepAdapters(adapter => {
    seen.push(pathOf(adapter))
    return seen.length <= 2
  })
  expect(seen).toEqual(['a', 'd', 'c', 'b'])
  expect(freed).toEqual(['c', 'b'])
  expect(cachedAdapterCount()).toBe(2)
  const kept = await read('a')
  await keepAdapters(() => true)
  expect(freed).toEqual(['c', 'b'])
  expect(await read('a')).toBe(kept)
})

test('each adapter carries the request count of its latest request', async () => {
  await read('a')
  const since = adapterRequests()
  await read('b')
  await read('a')
  const recent: string[] = []
  await keepAdapters((adapter, lastRequest) => {
    if (lastRequest > since) {
      recent.push(pathOf(adapter))
    }
    return true
  })
  expect(recent).toEqual(['a', 'b'])
})

test('keeping none empties the cache, and a later request builds anew', async () => {
  const first = await read('a')
  await keepAdapters(() => false)
  expect(freed).toEqual(['a'])
  expect(cachedAdapterCount()).toBe(0)
  expect(await read('a')).not.toBe(first)
})
