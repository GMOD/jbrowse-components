import { toArray } from 'rxjs/operators'
import BaseFeatureDataAdapter from './BaseAdapter'
import { ObservableCreate } from '../util/rxjs'

describe('base data adapter', () => {
  it('properly propagates errors in feature fetching', async () => {
    class Adapter extends BaseFeatureDataAdapter {
      async getRefNames() {
        return ['ctgA', 'ctgB']
      }

      getFeatures() {
        return ObservableCreate(() =>
          Promise.reject(new Error('something blew up')),
        )
      }
    }
    const adapter = new Adapter()
    const features = adapter.getFeaturesInRegion({
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

      getFeatures() {
        return ObservableCreate(observer => {
          observer.next({
            id: 'testFeature',
            start: 100,
            end: 200,
          })
          observer.complete()
        })
      }
    }
    const adapter = new Adapter()
    const features = adapter.getFeaturesInRegion({
      refName: 'ctgA',
      start: 0,
      end: 20000,
    })
    const featuresArray = await features.pipe(toArray()).toPromise()
    expect(featuresArray).toMatchInlineSnapshot(`
Array [
  Object {
    "end": 200,
    "id": "testFeature",
    "start": 100,
  },
]
`)
    const features2 = adapter.getFeaturesInRegion({
      refName: 'ctgC',
      start: 0,
      end: 20000,
    })
    const featuresArray2 = await features2.pipe(toArray()).toPromise()
    expect(featuresArray2).toMatchInlineSnapshot('Array []')
  })
})
