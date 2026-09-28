import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/configurationSchema.ts'
import AdapterType from '../pluggableElementTypes/AdapterType.ts'
import CoreGetRefNames from '../rpc/methods/CoreGetRefNames.ts'
import { ObservableCreate } from '../util/rxjs.ts'
import SimpleFeature from '../util/simpleFeature.ts'
import { BaseFeatureDataAdapter } from './BaseAdapter/index.ts'
import {
  READS_REFERENCE,
  clearAdapterCache,
  getAdapter,
} from './dataAdapterCache.ts'
import { getFeatureAdapterOrThrow } from './getFeatureAdapter.ts'
import { getSequenceSubAdapter } from './getSequenceSubAdapter.ts'

import type { Feature, Region } from '../util/index.ts'

// Stands in for BAM/CRAM and the scans: an adapter that cannot answer without
// the reference it was built with. `getRefNames` asks the reference, as a
// scan adapter does, so the refName map load is a reference read too.
class ReferenceReadingAdapter extends BaseFeatureDataAdapter {
  reference() {
    return getSequenceSubAdapter(this, undefined)
  }

  async getRefNames() {
    return (await this.reference()).getRefNames()
  }

  getFeatures(region: Region) {
    return ObservableCreate<Feature>(async observer => {
      const seq = await (await this.reference()).getSequence(region)
      observer.next(new SimpleFeature({ uniqueId: 'f1', ...region, seq }))
      observer.complete()
    })
  }
}

// a file-reading adapter that never reads the reference, as a synteny one
class PlainAdapter extends BaseFeatureDataAdapter {
  async getRefNames() {
    return ['ctgA']
  }

  getFeatures() {
    return ObservableCreate<Feature>(observer => {
      observer.complete()
    })
  }
}

class TestSequenceAdapter extends BaseFeatureDataAdapter {
  async getRefNames() {
    return ['ctgA']
  }

  async getSequence() {
    return 'ACGT'
  }

  getFeatures() {
    return ObservableCreate<Feature>(observer => {
      observer.complete()
    })
  }
}

class OtherSequenceAdapter extends TestSequenceAdapter {
  async getSequence() {
    return 'TTTT'
  }
}

const pluginManager = new PluginManager()
for (const [name, AdapterClass, capabilities] of [
  ['ReferenceReadingAdapter', ReferenceReadingAdapter, [READS_REFERENCE]],
  ['PlainAdapter', PlainAdapter, []],
  ['TestSequenceAdapter', TestSequenceAdapter, []],
  ['OtherSequenceAdapter', OtherSequenceAdapter, []],
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

const reading = { type: 'ReferenceReadingAdapter' }
const plain = { type: 'PlainAdapter' }
const sequenceA = { type: 'TestSequenceAdapter' }
const sequenceB = { type: 'OtherSequenceAdapter' }
const region = { refName: 'ctgA', start: 0, end: 4, assemblyName: 'volvox' }

async function resolve(
  adapterConfig: Record<string, unknown>,
  sequenceAdapter?: Record<string, unknown>,
) {
  return getFeatureAdapterOrThrow({
    pluginManager,
    sessionId: 'test',
    adapterConfig,
    sequenceAdapter,
  })
}

async function readThrough(sequenceAdapter?: Record<string, unknown>) {
  const features = await (
    await resolve(reading, sequenceAdapter)
  ).getFeaturesArray(region)
  return features[0]!.get('seq') as string
}

beforeEach(() => {
  clearAdapterCache()
})

// grape's and peach's GC tracks are one config, `{ type: 'GCContentAdapter' }`,
// and one BAM shown on two assemblies is one config too. Keyed on the config
// alone, whichever genome reached the instance first answered for both.
test('a reference-reading type reads the sequence it was built with, one instance per genome', async () => {
  await expect(readThrough(sequenceA)).resolves.toBe('ACGT')
  await expect(readThrough(sequenceB)).resolves.toBe('TTTT')
  const [a, b] = await Promise.all([
    resolve(reading, sequenceA),
    resolve(reading, sequenceB),
  ])
  expect(a).not.toBe(b)
})

test('the same reference snapshot is the same instance, whichever call built it', async () => {
  await new CoreGetRefNames(pluginManager).invoke({
    sessionId: 'test',
    adapterConfig: reading,
    sequenceAdapter: sequenceA,
  })
  const built = await getAdapter(pluginManager, 'test', reading, sequenceA)
  expect(await resolve(reading, { ...sequenceA })).toBe(built.dataAdapter)
})

// Built for no genome, the instance is still a working adapter for header and
// metadata calls; only a reference read refuses, and it says why.
test('built with no genome named, a reference read throws rather than guessing', async () => {
  const dataAdapter = await resolve(reading)
  expect(dataAdapter.sequenceAdapterConfig).toBeUndefined()
  await expect(readThrough()).rejects.toThrow(
    /ReferenceReadingAdapter was built with no reference: the request that created it named no assembly/,
  )
})

// The refName map load is the first request a track makes, and a scan
// adapter answers it by asking the reference: nothing has to arrive before it.
test('CoreGetRefNames on a cold cache resolves a scan adapter for its genome', async () => {
  await expect(
    new CoreGetRefNames(pluginManager).invoke({
      sessionId: 'test',
      adapterConfig: reading,
      sequenceAdapter: sequenceA,
    }),
  ).resolves.toEqual(['ctgA'])
})

test('a type that does not read the reference stays one instance across genomes, as a synteny adapter needs', async () => {
  const [a, b] = await Promise.all([
    resolve(plain, sequenceA),
    resolve(plain, sequenceB),
  ])
  expect(a).toBe(b)
  expect(a.sequenceAdapterConfig).toBeUndefined()
})
