import { toArray } from 'rxjs/operators'
import { BaseFeatureDataAdapter } from './BaseAdapter'
import { ObservableCreate } from '../util/rxjs'
import SimpleFeature, { Feature } from '../util/simpleFeature'
import { Region } from '../util/types'

describe('base data adapter', () => {
  it('properly propagates errors in feature fetching', async () => {
    class Adapter extends BaseFeatureDataAdapter {
      async getRefNames() {
        return ['ctgA', 'ctgB']
      }

      getFeatures(region: Region) {
        return ObservableCreate<Feature>(() =>
          Promise.reject(new Error('something blew up')),
        )
      }

      freeResources(): void {}
    }
    const adapter = new Adapter({})
    const features = adapter.getFeatures({
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 20000,
    })
    const featuresArray = features.pipe(toArray()).toPromise()
    expect(featuresArray).rejects.toThrow(/something blew up/)
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
    const adapter = new Adapter({})
    const features = adapter.getFeatures({
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 20000,
    })
    const featuresArray = await features.pipe(toArray()).toPromise()
    expect(featuresArray).toMatchInlineSnapshot(`
      Array [
        Object {
          "end": 200,
          "start": 100,
          "uniqueId": "testFeature",
        },
      ]
    `)
    const features2 = adapter.getFeatures({
      assemblyName: 'volvox',
      refName: 'ctgC',
      start: 0,
      end: 20000,
    })
    const featuresArray2 = await features2.pipe(toArray()).toPromise()
    expect(featuresArray2).toMatchInlineSnapshot('Array []')
  })
})
