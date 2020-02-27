import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import Adapter from './MCScanAnchorsAdapter'

class CustomAdapter extends BaseAdapter {
  async getRefNames() {
    return []
  }

  freeResources() {}

  getFeatures(region: IRegion, opts: BaseOptions) {
    return ObservableCreate<Feature>(async observer => {
      observer.complete()
    })
  }
}

test('adapter can fetch features from volvox.bam', async () => {
  // const adapter = new Adapter({
  //   mcscanAnchorsLocation: {
  //     localPath: require.resolve('./test_data/grape.peach.anchors'),
  //   },
  //   geneAdapter1: new CustomAdapter(),
  //   geneAdapter2: new CustomAdapter(),
  // })

  //   const features = await adapter.getFeatures({
  //     refName: 'ctgA',
  //     start: 0,
  //     end: 20000,
  //     assemblyName: 'peach',
  //   })

  //   const featuresArray = await features.pipe(toArray()).toPromise()
  //   expect(featuresArray[0].get('refName')).toBe('ctgA')
  //   const featuresJsonArray = featuresArray.map(f => f.toJSON())
  //   expect(featuresJsonArray.length).toEqual(3809)
  //   expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()
})
