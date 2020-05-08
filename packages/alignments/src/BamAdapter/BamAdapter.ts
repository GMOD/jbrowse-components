import { BamFile } from '@gmod/bam'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import { Region } from '@gmod/jbrowse-core/util/types'
import { checkAbortSignal } from '@gmod/jbrowse-core/util'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import BamSlightlyLazyFeature from './BamSlightlyLazyFeature'

import MyConfigSchema from './configSchema'

interface HeaderLine {
  tag: string
  value: string
}
interface Header {
  idToName?: string[]
  nameToId?: Record<string, number>
}

export default class BamAdapter extends BaseFeatureDataAdapter {
  private bam: BamFile

  private samHeader: Header = {}

  public constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    const bamLocation = readConfObject(config, 'bamLocation')
    const location = readConfObject(config, ['index', 'location'])
    const indexType = readConfObject(config, ['index', 'indexType'])
    const chunkSizeLimit = readConfObject(config, 'chunkSizeLimit')
    const fetchSizeLimit = readConfObject(config, 'fetchSizeLimit')

    this.bam = new BamFile({
      bamFilehandle: openLocation(bamLocation),
      csiFilehandle: indexType === 'CSI' ? openLocation(location) : undefined,
      baiFilehandle: indexType !== 'CSI' ? openLocation(location) : undefined,
      chunkSizeLimit,
      fetchSizeLimit,
    })
  }

  private async setup(opts?: BaseOptions) {
    if (Object.keys(this.samHeader).length === 0) {
      const samHeader = await this.bam.getHeader(opts?.signal)

      // use the @SQ lines in the header to figure out the
      // mapping between ref ref ID numbers and names
      const idToName: string[] = []
      const nameToId: Record<string, number> = {}
      const sqLines = samHeader.filter((l: { tag: string }) => l.tag === 'SQ')
      sqLines.forEach((sqLine: { data: HeaderLine[] }, refId: number) => {
        sqLine.data.forEach((item: HeaderLine) => {
          if (item.tag === 'SN') {
            // this is the ref name
            const refName = item.value
            nameToId[refName] = refId
            idToName[refId] = refName
          }
        })
      })
      if (idToName.length) {
        this.samHeader = { idToName, nameToId }
      }
    }
  }

  async getRefNames(opts?: BaseOptions) {
    await this.setup(opts)
    if (this.samHeader.idToName) {
      return this.samHeader.idToName
    }
    throw new Error('unable to get refnames')
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { refName, start, end } = region
      await this.setup(opts)
      const records = await this.bam.getRecordsForRange(
        refName,
        start,
        end,
        opts,
      )
      checkAbortSignal(opts.signal)

      records.forEach(record => {
        observer.next(new BamSlightlyLazyFeature(record, this))
      })
      observer.complete()
    }, opts.signal)
  }

  freeResources(/* { region } */): void {}

  // depends on setup being called before the BAM constructor
  refIdToName(refId: number): string | undefined {
    if (this.samHeader.idToName) {
      return this.samHeader.idToName[refId]
    }
    return undefined
  }
}
