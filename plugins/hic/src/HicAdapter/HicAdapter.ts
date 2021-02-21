import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region, FileLocation } from '@jbrowse/core/util/types'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { openLocation } from '@jbrowse/core/util/io'
import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import type { GenericFilehandle } from 'generic-filehandle'
import HicStraw from 'hic-straw'
import MyConfigSchema from './configSchema'

interface ContactRecord {
  bin1: number
  bin2: number
  counts: number
}

interface HicMetadata {
  chromosomes: {
    name: string
    length: number
    id: number
  }[]
  resolutions: number[]
}
interface Ref {
  chr: string
  start: number
  end: number
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
  private hic: {
    getContactRecords: (
      normalize: string,
      ref: Ref,
      ref2: Ref,
      units: string,
      binsize: number,
    ) => Promise<ContactRecord[]>
    getMetaData: () => Promise<HicMetadata>
  }

  public constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    const hicLocation = readConfObject(config, 'hicLocation')
    this.hic = new HicStraw({
      file: openFilehandleWrapper(hicLocation),
    })
  }

  private async setup(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    statusCallback('Downloading .hic header')
    const result = await this.hic.getMetaData()
    statusCallback('')
    return result
  }

  public async getHeader(opts?: BaseOptions) {
    const ret = await this.setup(opts)
    const { chromosomes, ...rest } = ret
    return rest
  }

  async getRefNames(opts?: BaseOptions) {
    const metadata = await this.setup(opts)
    return metadata.chromosomes.map(chr => chr.name)
  }

  async getResolution(bpPerPx: number, opts?: BaseOptions) {
    const metadata = await this.setup(opts)
    const { resolutions } = metadata
    let chosenResolution = resolutions[resolutions.length - 1]

    for (let i = resolutions.length - 1; i >= 0; i -= 1) {
      const r = resolutions[i]
      if (r <= 5 * bpPerPx) {
        chosenResolution = r
      }
    }
    return chosenResolution
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<ContactRecord>(async observer => {
      const { refName: chr, start, end } = region
      const { resolution, bpPerPx, statusCallback = () => {} } = opts
      const res = await this.getResolution(bpPerPx / resolution || 1000, opts)
      statusCallback('Downloading .hic data')

      const records = await this.hic.getContactRecords(
        'KR',
        { start, chr, end },
        { start, chr, end },
        'BP',
        res,
      )
      records.forEach(record => {
        observer.next(record)
      })
      statusCallback('')
      observer.complete()
    }, opts.signal) as any // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  freeResources(/* { region } */): void {}
}
