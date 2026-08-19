import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/configurationSchema.ts'
import AdapterType from '../pluggableElementTypes/AdapterType.ts'
import CoreGetRefNames from '../rpc/methods/CoreGetRefNames.ts'
import { ObservableCreate } from '../util/rxjs.ts'
import SimpleFeature from '../util/simpleFeature.ts'
import { BaseFeatureDataAdapter } from './BaseAdapter/index.ts'
import { clearAdapterCache } from './dataAdapterCache.ts'
import { getFeatureAdapterOrThrow } from './getFeatureAdapter.ts'

import type { Feature, Region } from '../util/index.ts'
import type { BaseSequenceAdapter } from './BaseAdapter/index.ts'

// Stands in for BAM/CRAM: an adapter that cannot answer a query without the
// reference, and that learns where the reference is only from priming.
class ReferenceReadingAdapter extends BaseFeatureDataAdapter {
  async getRefNames() {
    return ['ctgA']
  }

  async getSequenceAdapter() {
    const config = this.sequenceAdapterConfig
    if (!config) {
      return undefined
    }
    const result = await this.getSubAdapter?.(config)
    return result?.dataAdapter as BaseSequenceAdapter | undefined
  }

  getFeatures(region: Region) {
    return ObservableCreate<Feature>(async observer => {
      const seq = await (await this.getSequenceAdapter())?.getSequence(region)
      observer.next(
        new SimpleFeature({ uniqueId: 'f1', ...region, seq: seq ?? null }),
      )
      observer.complete()
    })
  }
}

// The shape of every ReferenceScanAdapter subclass (motif, CRISPR guide,
// sequence search): it has no file of its own, so it answers `getRefNames` by
// asking the reference — which means it must already be primed by the time
// `CoreGetRefNames` calls it.
class ScanAdapter extends BaseFeatureDataAdapter {
  async getRefNames() {
    const config = this.sequenceAdapterConfig
    if (!config) {
      throw new Error('No sequence adapter available')
    }
    const result = await this.getSubAdapter?.(config)
    return (result?.dataAdapter as BaseSequenceAdapter).getRefNames()
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

const pluginManager = new PluginManager()
for (const [name, AdapterClass] of [
  ['ReferenceReadingAdapter', ReferenceReadingAdapter],
  ['ScanAdapter', ScanAdapter],
  ['TestSequenceAdapter', TestSequenceAdapter],
] as const) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name,
        configSchema: ConfigurationSchema(name, {}, { explicitlyTyped: true }),
        getAdapterClass: () => Promise.resolve(AdapterClass),
      }),
  )
}
pluginManager.createPluggableElements()
pluginManager.configure()

const adapterConfig = { type: 'ReferenceReadingAdapter' }
const sequenceAdapter = { type: 'TestSequenceAdapter' }
const region = { refName: 'ctgA', start: 0, end: 4, assemblyName: 'volvox' }

// A fetch that passes no sequenceAdapter of its own — CoreGetFeatures as
// `fetchTrackData` calls it, and BreakpointGetFeatures and CoreGetExportData,
// none of which forward one.
async function fetchWithoutPriming() {
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId: 'test',
    adapterConfig,
  })
  const features = await dataAdapter.getFeaturesArray(region)
  return features[0]!.get('seq') as string | null
}

function getRefNames(args: Record<string, unknown>) {
  return new CoreGetRefNames(pluginManager).invoke({
    sessionId: 'test',
    adapterConfig,
    ...args,
  })
}

beforeEach(() => {
  clearAdapterCache()
})

// The contract three RPCs depend on and none of them state. `dataAdapterCache`
// keys on adapterConfig alone, so the sequence config CoreGetRefNames leaves on
// the instance is what every later fetch reads — including the ones that pass
// nothing. Sabotaging the priming reds this; sabotaging any single caller does
// not, which is why the coverage cannot live at a call site.
test('CoreGetRefNames primes the cached instance for a later fetch that passes nothing', async () => {
  await getRefNames({ sequenceAdapter })
  await expect(fetchWithoutPriming()).resolves.toBe('ACGT')
})

// The other half: the priming is the ONLY thing standing between those callers
// and a silent no-reference read. Without it a BAM reports no mismatches and a
// CRAM throws, neither of which names the cause.
test('without it the same fetch reads no reference, and says nothing', async () => {
  await expect(fetchWithoutPriming()).resolves.toBeNull()
})

// Set-once covers two different strays: a caller with nothing to offer must not
// clear the field, and a caller with something *else* to offer must not replace
// it. One `??=` does both, which is why `setSequenceAdapterConfig` needs no
// `if (config)` around it — the guard it used to carry changed no outcome, and
// removing it reds nothing here or anywhere else.
//
// What set-once does not settle is which config gets there first.
// `renameRegionsIfNeeded` resolves one refName map per assembly through
// `Promise.all`, each priming the same cached instance, so an adapter config
// displayed against two assemblies takes whichever call resolves first. No
// adapter that reads the reference is displayed that way today; if one ever is,
// this is the line that decides it.
test('a later call passing no sequence adapter does not clear it', async () => {
  await getRefNames({ sequenceAdapter })
  await getRefNames({})
  await expect(fetchWithoutPriming()).resolves.toBe('ACGT')
})

test('a later call naming a different sequence adapter does not replace it', async () => {
  await getRefNames({ sequenceAdapter })
  await getRefNames({ sequenceAdapter: { type: 'NoSuchSequenceAdapter' } })
  await expect(fetchWithoutPriming()).resolves.toBe('ACGT')
})

// The ordering inside `CoreGetRefNames` is load-bearing and reads as arbitrary:
// it primes, THEN calls getRefNames. Swap those two statements and a scan track
// throws "No sequence adapter available" on the first refName map it needs,
// which is before anything is on screen to hint at the cause. Nothing else
// pinned it — the swap left 3,015 tests green.
test('CoreGetRefNames primes before it asks, so a scan adapter can answer', async () => {
  await expect(
    new CoreGetRefNames(pluginManager).invoke({
      sessionId: 'test',
      adapterConfig: { type: 'ScanAdapter' },
      sequenceAdapter,
    }),
  ).resolves.toEqual(['ctgA'])
})
