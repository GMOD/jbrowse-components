import { Observable } from 'rxjs'
import { toArray } from 'rxjs/operators'
import BaseAdapter from './BaseAdapter'

describe('base data adapter', () => {
  it('throws if instantiated directly', () => {
    expect(() => {
      // eslint-disable-next-line no-new
      new BaseAdapter({}, {})
    }).toThrow(/Cannot create BaseAdapter instances directly/)
  })

  it('throws if loadData() is not overridden by the subclass', async () => {
    class Adapter extends BaseAdapter {
      async getFeatures() {
        return Observable.create(observer => {
          observer.next({
            id: 'testFeature',
            start: 100,
            end: 200,
          })
          observer.complete()
        })
      }
    }
    const adapter = new Adapter({ assemblyName: 'volvox' }, {})
    await expect(
      adapter.getFeaturesInRegion({
        assemblyName: 'volvox',
        refName: 'ctgA',
        start: 0,
        end: 20000,
      }),
    ).rejects.toThrow(/loadData should be overridden by the subclass/)
  })

  it('throws if getFeatures() is not overridden by the subclass', async () => {
    class Adapter extends BaseAdapter {
      async loadData() {
        return ['ctgA', 'ctgB']
      }
    }
    const adapter = new Adapter({ assemblyName: 'volvox' }, {})
    await expect(
      adapter.getFeatures({
        assemblyName: 'volvox',
        refName: 'ctgA',
        start: 0,
        end: 20000,
      }),
    ).rejects.toThrow(/getFeatures should be overridden by the subclass/)
  })

  it('throws if freeResources() is not overridden by the subclass', async () => {
    class Adapter extends BaseAdapter {
      async loadData() {
        return ['ctgA', 'ctgB']
      }
    }
    const adapter = new Adapter({ assemblyName: 'volvox' }, {})
    expect(() => adapter.freeResources()).toThrow(
      /freeResources should be overridden by the subclass/,
    )
  })

  it('retrieves features', async () => {
    class Adapter extends BaseAdapter {
      async loadData() {
        return ['ctgA', 'ctgB']
      }

      async getFeatures() {
        return Observable.create(observer => {
          observer.next({
            id: 'testFeature',
            start: 100,
            end: 200,
          })
          observer.complete()
        })
      }
    }
    const adapter = new Adapter({ assemblyName: 'volvox' }, {})
    const features = await adapter.getFeaturesInRegion({
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
    "id": "testFeature",
    "start": 100,
  },
]
`)
    const features2 = await adapter.getFeaturesInRegion({
      assemblyName: 'volvox',
      refName: 'ctgC',
      start: 0,
      end: 20000,
    })
    const featuresArray2 = await features2.pipe(toArray()).toPromise()
    expect(featuresArray2).toMatchInlineSnapshot(`Array []`)
  })
})
