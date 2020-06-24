import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import { Region, FileLocation } from '@gmod/jbrowse-core/util/types'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import HicStraw from 'hic-straw'
import type { GenericFilehandle } from 'generic-filehandle'
import MyConfigSchema from './configSchema'

interface ContactRecord {
  bin1: number
  bin2: number
  counts: number
}

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
    return buffer.buffer.slice(0, bytesRead)
  }
}
export function openFilehandleWrapper(location: FileLocation) {
  return new GenericFilehandleWrapper(openLocation(location))
}

export default class HicAdapter extends BaseFeatureDataAdapter {
  private hic: { getContactRecords: Function }

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
    // have to cast to any because ContactRecord does not match SimpleFeature interface
    return ObservableCreate<ContactRecord>(async observer => {
      const { refName: chr, start, end } = region
      const records = await this.hic.getContactRecords(
        'KR',
        { start, chr, end },
        { start, chr, end },
        'BP',
        10000,
      )
      records.forEach((record: ContactRecord) => {
        observer.next(record)
      })
      observer.complete()
    }, opts.signal) as any // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  freeResources(/* { region } */): void {}
}
