import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import { Region, FileLocation } from '@gmod/jbrowse-core/util/types'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import HicStraw from 'hic-straw'
import type { GenericFilehandle } from 'generic-filehandle'
import MyConfigSchema from './configSchema'

// wraps generic-filehandle so the read function only takes a position and length
// in some ways, generic-filehandle wishes it was just this but it has
// to adapt to the node.js fs promises API
class GenericFilehandleWrapper {
  private filehandle: GenericFilehandle

  constructor(filehandle: GenericFilehandle) {
    this.filehandle = filehandle
  }

  async read(position: number, length: number) {
    const { buffer, bytesRead } = await this.filehandle.read(
      Buffer.allocUnsafe(length),
      0,
      length,
      position,
    )
    console.log(bytesRead, buffer.length)
    return buffer.buffer.slice(0, bytesRead)
  }
}
export function openFilehandleWrapper(location: FileLocation) {
  return new GenericFilehandleWrapper(openLocation(location))
}

export default class HicAdapter extends BaseFeatureDataAdapter {
  private hic: GenericFilehandleWrapper

  public constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    const hicLocation = readConfObject(config, 'hicLocation')
    this.hic = new HicStraw({
      file: openFilehandleWrapper(hicLocation),
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
        100000,
      )
      records.forEach(record => {
        observer.next(record)
      })
      observer.complete()
    }, opts.signal)
  }

  freeResources(/* { region } */): void {}
}
