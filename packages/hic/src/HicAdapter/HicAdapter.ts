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
    console.log(hicLocation)

    this.hic = new HicStraw({
      url: hicLocation.uri,
    })
  }

  async getRefNames(opts?: BaseOptions) {
    return []
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { refName: chr, start, end } = region
      const records = await this.hic.getContactRecords(
        'KR',
        { start, chr, end },
        { start, chr, end },
        'BP',
        10000,
      )
      records.forEach(record => {
        observer.next(record)
      })
      observer.complete()
    }, opts.signal)
  }

  freeResources(/* { region } */): void {}
}
