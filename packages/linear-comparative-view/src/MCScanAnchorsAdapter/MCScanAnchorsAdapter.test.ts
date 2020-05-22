import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { Region } from '@gmod/jbrowse-core/util/types'
import { toArray } from 'rxjs/operators'
import { getSubAdapterType } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import Adapter from './MCScanAnchorsAdapter'

class CustomAdapter extends BaseFeatureDataAdapter {
  async getRefNames() {
    return []
  }

  freeResources() {}

  getFeatures(region: Region, opts: BaseOptions) {
    return ObservableCreate<Feature>(async observer => {
      if (region.assemblyName === 'peach') {
        observer.next(
          new SimpleFeature({
            uniqueId: '1',
            start: 0,
            end: 100,
            refName: 'peach_chr1',
            syntenyId: 1,
            name: 'GSVIVT01012253001',
          }),
        )
      }
      if (region.assemblyName === 'grape') {
        observer.next(
          new SimpleFeature({
            start: 0,
            uniqueId: '2',
            end: 100,
            refName: 'grape_chr1',
            syntenyId: 1,
            name: 'Prupe.1G290800.1',
          }),
        )
      }
      observer.complete()
    })
  }
}

const getSubAdapter: getSubAdapterType = () => {
  return {
    dataAdapter: new CustomAdapter(),
    sessionIds: new Set(),
  }
}
test('adapter can fetch features from volvox.bam', async () => {
  const adapter = new Adapter(
    {
      mcscanAnchorsLocation: {
        localPath: require.resolve('./test_data/grape.peach.anchors'),
      },
      subadapters: [new CustomAdapter(), new CustomAdapter()],
      assemblyNames: ['grape', 'peach'],
    },
    getSubAdapter,
  )

  const features1 = await adapter.getFeatures({
    refName: 'peach_chr1',
    start: 0,
    end: 20000,
    assemblyName: 'peach',
  })

  const features2 = await adapter.getFeatures({
    refName: 'grape_chr1',
    start: 0,
    end: 20000,
    assemblyName: 'grape',
  })

  const fa1 = await features1.pipe(toArray()).toPromise()
  const fa2 = await features2.pipe(toArray()).toPromise()
  expect(fa1.length).toBe(2)
  expect(fa2.length).toBe(1)
  expect(fa1[0].get('refName')).toBe('peach_chr1')
  expect(fa2[0].get('refName')).toBe('grape_chr1')
  expect(fa1[0].get('syntenyId')).toEqual(fa2[0].get('syntenyId'))
})
