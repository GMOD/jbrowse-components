import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import { Region } from '@gmod/jbrowse-core/util/types'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import HicStraw from 'hic-straw'

import MyConfigSchema from './configSchema'

export default class HicAdapter extends BaseFeatureDataAdapter {
  private hic: any

  public constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    const hicLocation = readConfObject(config, 'hicLocation')

    this.hic = new HicStraw({
      //  url: hicLocation,
      url:
        'https://s3.amazonaws.com/igv.broadinstitute.org/data/hic/intra_nofrag_30.hic',
    })
  }

  async getRefNames(opts?: BaseOptions) {
    return []
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const contactRecords = await straw.getContactRecords(
        'KR',
        { chr: '8', start: 50000000, end: 60000000 },
        { chr: '8', start: 50000000, end: 60000000 },
        'BP',
        1000000,
      )
      console.log(contactRecords)
      // const { refName, start, end } = region
      // await this.setup(opts)
      // const records = await this.bam.getRecordsForRange(
      //   refName,
      //   start,
      //   end,
      //   opts,
      // )
      // checkAbortSignal(opts.signal)

      // records.forEach(record => {
      //   observer.next(new BamSlightlyLazyFeature(record, this))
      // })
      observer.complete()
    }, opts.signal)
  }

  freeResources(/* { region } */): void {}
}
