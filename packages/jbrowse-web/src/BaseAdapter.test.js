import { toArray } from 'rxjs/operators'
import BaseAdapter from './BaseAdapter'
import { ObservableCreate } from './util/rxjs'

describe('base data adapter', () => {
  it('throws if instantiated directly', () => {
    expect(() => {
      // eslint-disable-next-line no-new
      new BaseAdapter({}, {})
    }).toThrow(/Cannot create BaseAdapter instances directly/)
  })

  it('throws if loadData() is not overridden by the subclass', async () => {
    class Adapter extends BaseAdapter {
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

    const p = new Promise((resolve, reject) => {
      const adapter = new Adapter({ assemblyName: 'volvox' }, {})
      return adapter
        .getFeaturesInRegion({
          assemblyName: 'volvox',
          refName: 'ctgA',
          start: 0,
          end: 20000,
        })
        .toPromise()
        .then(resolve, reject)
    })

    expect(p).rejects.toThrow(/loadData should be overridden by the subclass/)
  })

  it('throws if getFeatures() is not overridden by the subclass', async () => {
    class Adapter extends BaseAdapter {
      async loadData() {
        return ['ctgA', 'ctgB']
      }
    }
    const adapter = new Adapter({ assemblyName: 'volvox' }, {})

    expect(() =>
      adapter
        .getFeatures({
          assemblyName: 'volvox',
          refName: 'ctgA',
          start: 0,
          end: 20000,
        })
        .toPromise(),
    ).toThrow(/getFeatures should be overridden by the subclass/)
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

  it('properly propagates errors in feature fetching', async () => {
    class Adapter extends BaseAdapter {
      async loadData() {
        return ['ctgA', 'ctgB']
      }

      getFeatures() {
        return ObservableCreate(() =>
          Promise.reject(new Error('something blew up')),
        )
      }
    }
    const adapter = new Adapter({ assemblyName: 'volvox' }, {})
    const features = adapter.getFeaturesInRegion({
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 20000,
    })
    const featuresArray = features.pipe(toArray()).toPromise()
    expect(featuresArray).rejects.toThrow(/something blew up/)
  })

  it('retrieves features', async () => {
    class Adapter extends BaseAdapter {
      async loadData() {
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
    const adapter = new Adapter({ assemblyName: 'volvox' }, {})
    const features = adapter.getFeaturesInRegion({
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
    const features2 = adapter.getFeaturesInRegion({
      assemblyName: 'volvox',
      refName: 'ctgC',
      start: 0,
      end: 20000,
    })
    const featuresArray2 = await features2.pipe(toArray()).toPromise()
    expect(featuresArray2).toMatchInlineSnapshot(`Array []`)
  })
})
