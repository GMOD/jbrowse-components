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
import { toArray } from 'rxjs/operators'

import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import { getSubAdapterType } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import BamSlightlyLazyFeature from './BamSlightlyLazyFeature'

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

  private sequenceAdapter?: BaseFeatureDataAdapter

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
  ) {
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

    const adapterConfig = readConfObject(config, 'sequenceAdapter')
    if (adapterConfig && getSubAdapter) {
      const { dataAdapter } = getSubAdapter(adapterConfig)
      this.sequenceAdapter = dataAdapter as BaseFeatureDataAdapter
    }
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

  private async seqFetch(refName: string, start: number, end: number) {
    const refSeqStore = this.sequenceAdapter
    if (!refSeqStore) return undefined
    if (!refName) return undefined

    const features = refSeqStore.getFeatures(
      {
        refName,
        start,
        end,
        assemblyName: '',
      },
      {},
    )

    const seqChunks = await features.pipe(toArray()).toPromise()

    const trimmed: string[] = []
    seqChunks
      .sort((a: Feature, b: Feature) => a.get('start') - b.get('start'))
      .forEach((chunk: Feature) => {
        const chunkStart = chunk.get('start')
        const chunkEnd = chunk.get('end')
        const trimStart = Math.max(start - chunkStart, 0)
        const trimEnd = Math.min(end - chunkStart, chunkEnd - chunkStart)
        const trimLength = trimEnd - trimStart
        const chunkSeq = chunk.get('seq') || chunk.get('residues')
        trimmed.push(chunkSeq.substr(trimStart, trimLength))
      })

    const sequence = trimmed.join('')
    if (sequence.length !== end - start) {
      throw new Error(
        `sequence fetch failed: fetching ${refName}:${(
          start - 1
        ).toLocaleString()}-${end.toLocaleString()} returned ${sequence.length.toLocaleString()} bases, but should have returned ${(
          end - start
        ).toLocaleString()}`,
      )
    }
    return sequence
  }

  getFeatures(
    region: Region & { originalRefName?: string },
    opts: BaseOptions = {},
  ) {
    const { refName, start, end, originalRefName } = region
    return ObservableCreate<Feature>(async observer => {
      await this.setup(opts)
      const records = await this.bam.getRecordsForRange(
        refName,
        start,
        end,
        opts,
      )
      checkAbortSignal(opts.signal)

      await Promise.all(
        records.map(async record => {
          let ref: string | undefined
          if (!record.get('md')) {
            ref = await this.seqFetch(
              originalRefName || refName,
              record.get('start'),
              record.get('end'),
            )
          }
          observer.next(new BamSlightlyLazyFeature(record, this, ref))
        }),
      )
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
