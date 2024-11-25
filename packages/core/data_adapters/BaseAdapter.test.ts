import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { BaseFeatureDataAdapter } from './BaseAdapter'
import { ConfigurationSchema } from '../configuration/configurationSchema'
import { ObservableCreate } from '../util/rxjs'
import SimpleFeature from '../util/simpleFeature'
import type { Feature } from '../util/simpleFeature'
import type { Region } from '../util/types'

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

      freeResources(): void {}
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

      freeResources(): void {}
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
