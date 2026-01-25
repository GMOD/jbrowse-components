import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { BaseFeatureDataAdapter } from './BaseAdapter/index.ts'
import { adapterConfigCacheKey } from './util.ts'
import { ConfigurationSchema } from '../configuration/configurationSchema.ts'
import { ObservableCreate } from '../util/rxjs.ts'
import PluginManager from '../PluginManager.ts'
import SimpleFeature from '../util/simpleFeature.ts'

import type { Feature } from '../util/simpleFeature.ts'
import type { Region } from '../util/types/index.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

describe('base data adapter', () => {
  it('properly propagates errors in feature fetching', async () => {
    class Adapter extends BaseFeatureDataAdapter {
      async getRefNames() {
        return ['ctgA', 'ctgB']
      }

      getFeatures(_region: Region) {
        return ObservableCreate<Feature>(() =>
          Promise.reject(new Error('something blew up')),
        )
      }
    }
    const adapter = new Adapter(ConfigurationSchema('empty', {}).create())
    const features = adapter.getFeatures({
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 20000,
    })
    try {
      await firstValueFrom(features.pipe(toArray()))
    } catch (e) {
      expect(`${e}`).toMatch(/something blew up/)
    }
  })

  it('retrieves features', async () => {
    class Adapter extends BaseFeatureDataAdapter {
      async getRefNames() {
        return ['ctgA', 'ctgB']
      }

      getFeatures(region: Region) {
        return ObservableCreate<Feature>(observer => {
          if (region.refName === 'ctgA') {
            observer.next(
              new SimpleFeature({
                uniqueId: 'testFeature',
                refName: region.refName,
                start: 100,
                end: 200,
              }),
            )
          }
          observer.complete()
        })
      }
    }
    const adapter = new Adapter(ConfigurationSchema('empty', {}).create())
    const features = adapter.getFeatures({
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 20000,
    })
    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    expect(featuresArray).toMatchSnapshot()

    const features2 = adapter.getFeatures({
      assemblyName: 'volvox',
      refName: 'ctgC',
      start: 0,
      end: 20000,
    })
    const featuresArray2 = await firstValueFrom(features2.pipe(toArray()))
    expect(featuresArray2).toMatchSnapshot()
  })
})

describe('adapterConfigCacheKey', () => {
  it('uses type + adapterId for configs with non-default values', () => {
    const AdapterConfig = ConfigurationSchema(
      'FromConfigAdapter',
      {
        features: { type: 'frozen', defaultValue: [] },
      },
      { explicitlyTyped: true, implicitIdentifier: 'adapterId' },
    )

    // Config with non-default features - should have type and adapterId in snapshot
    const adapter = AdapterConfig.create(
      { features: [{ id: 'feat1', start: 0, end: 100 }] },
      { pluginManager },
    )
    const snap = getSnapshot(adapter)

    // Verify snapshot has type and adapterId
    expect(snap.type).toBe('FromConfigAdapter')
    expect(snap.adapterId).toBeDefined()

    // Verify cache key uses type + adapterId (not idMaker hash)
    const cacheKey = adapterConfigCacheKey(snap)
    expect(cacheKey).toBe(`FromConfigAdapter-${snap.adapterId}`)
  })

  it('falls back to idMaker for configs without adapterId', () => {
    const AdapterConfig = ConfigurationSchema(
      'SomeAdapter',
      {
        uri: { type: 'string', defaultValue: '' },
      },
      { explicitlyTyped: true }, // no implicitIdentifier
    )

    const adapter = AdapterConfig.create({ uri: '/path/to/file' }, { pluginManager })
    const snap = getSnapshot(adapter)

    // Verify snapshot has type but no adapterId
    expect(snap.type).toBe('SomeAdapter')
    expect('adapterId' in snap).toBe(false)

    // Cache key should be idMaker hash (starts with 'adp-')
    const cacheKey = adapterConfigCacheKey(snap)
    expect(cacheKey).toMatch(/^adp-/)
  })
})
