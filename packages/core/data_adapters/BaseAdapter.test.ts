import { expect, test } from 'vitest'
import { toArray } from 'rxjs/operators'
import { BaseFeatureDataAdapter } from './BaseAdapter'
import { ObservableCreate } from '../util/rxjs'
import SimpleFeature, { Feature } from '../util/simpleFeature'
import { Region } from '../util/types'
import { ConfigurationSchema } from '../configuration/configurationSchema'

test('properly propagates errors in feature fetching', async () => {
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
  const featuresArray = features.pipe(toArray()).toPromise()

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  expect(featuresArray).rejects.toThrow(/something blew up/)
})

test('retrieves features', async () => {
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
  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray).toMatchSnapshot()

  const features2 = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgC',
    start: 0,
    end: 20000,
  })
  const featuresArray2 = await features2.pipe(toArray()).toPromise()
  expect(featuresArray2).toMatchSnapshot()
})
