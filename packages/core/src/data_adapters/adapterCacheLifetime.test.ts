import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/configurationSchema.ts'
import AdapterType from '../pluggableElementTypes/AdapterType.ts'
import { ObservableCreate } from '../util/rxjs.ts'
import { BaseFeatureDataAdapter } from './BaseAdapter/index.ts'
import {
  READS_REFERENCE,
  cachedAdapterCount,
  clearAdapterCache,
  freeAdapterResources,
  getAdapter,
} from './dataAdapterCache.ts'
import { getSequenceSubAdapter } from './getSequenceSubAdapter.ts'

import type { Feature } from '../util/index.ts'

let freed: string[] = []

class FeaturelessAdapter extends BaseFeatureDataAdapter {
  async getRefNames() {
    return ['ctgA']
  }

  getFeatures() {
    return ObservableCreate<Feature>(observer => {
      observer.complete()
    })
  }

  freeResources() {
    freed.push(this.config.type)
  }
}

class ReadingAdapter extends FeaturelessAdapter {
  reference() {
    return getSequenceSubAdapter(this, undefined)
  }
}

class SequenceAdapter extends FeaturelessAdapter {
  async getSequence() {
    return 'ACGT'
  }
}

const pluginManager = new PluginManager()
for (const [name, AdapterClass, capabilities] of [
  ['ReadingAdapter', ReadingAdapter, [READS_REFERENCE]],
  ['SequenceAdapter', SequenceAdapter, []],
  ['PlainAdapter', FeaturelessAdapter, []],
] as const) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name,
        configSchema: ConfigurationSchema(name, {}, { explicitlyTyped: true }),
        getAdapterClass: () => Promise.resolve(AdapterClass),
        adapterCapabilities: [...capabilities],
      }),
  )
}
pluginManager.createPluggableElements()
pluginManager.configure()

const reading = { type: 'ReadingAdapter' }
const sequence = { type: 'SequenceAdapter' }

async function readingAdapter(sessionId: string) {
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    reading,
    sequence,
  )
  if (!(dataAdapter instanceof ReadingAdapter)) {
    throw new Error('expected a ReadingAdapter')
  }
  return dataAdapter
}

beforeEach(() => {
  clearAdapterCache()
  freed = []
})

test('a session joining while another is freed keeps a live, cached adapter', async () => {
  const closing = readingAdapter('A')
  const freeing = freeAdapterResources({ sessionId: 'A' })
  const joining = readingAdapter('B')
  await Promise.all([closing, freeing])
  const joined = await joining
  expect(await readingAdapter('B')).toBe(joined)
  expect(freed).toEqual(['ReadingAdapter'])
})

test('a sub-adapter lives as long as its parent, whichever session fetched it', async () => {
  const parent = await readingAdapter('A')
  await readingAdapter('B')
  const reference = await parent.reference()

  await freeAdapterResources({ sessionId: 'A' })
  expect(cachedAdapterCount()).toBe(2)
  expect(freed).toEqual([])
  expect(await parent.reference()).toBe(reference)

  await freeAdapterResources({ sessionId: 'B' })
  expect(cachedAdapterCount()).toBe(0)
  expect(freed.sort()).toEqual(['ReadingAdapter', 'SequenceAdapter'])
})

test('a parent evicted mid-request still reads its reference, and leaves nothing cached', async () => {
  const parent = await readingAdapter('A')
  await freeAdapterResources({ sessionId: 'A' })
  await expect(
    (await parent.reference()).getSequence({
      refName: 'ctgA',
      start: 0,
      end: 4,
    }),
  ).resolves.toBe('ACGT')
  expect(cachedAdapterCount()).toBe(0)
})

test('renewed credentials replace the instance built with the old ones, keeping its claims', async () => {
  const signed = (token: string) => ({
    type: 'PlainAdapter',
    location: {
      uri: 'https://example.org/a.bed',
      internetAccountPreAuthorization: { authInfo: { token } },
    },
  })
  const first = await getAdapter(pluginManager, 'A', signed('t1'), undefined)
  const again = await getAdapter(pluginManager, 'A', signed('t1'), undefined)
  expect(again.dataAdapter).toBe(first.dataAdapter)

  const renewed = await getAdapter(pluginManager, 'B', signed('t2'), undefined)
  expect(renewed.dataAdapter).not.toBe(first.dataAdapter)
  expect(freed).toEqual(['PlainAdapter'])
  expect(cachedAdapterCount()).toBe(1)

  await freeAdapterResources({ sessionId: 'B' })
  expect(cachedAdapterCount()).toBe(1)
  await freeAdapterResources({ sessionId: 'A' })
  expect(cachedAdapterCount()).toBe(0)
})
