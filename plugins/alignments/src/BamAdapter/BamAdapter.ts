import { BamFile } from '@gmod/bam'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import { checkAbortSignal } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { toArray } from 'rxjs/operators'

import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { readConfObject } from '@jbrowse/core/configuration'
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
  // @ts-ignore  -- the configure method assigns this essentially via the constructor
  protected bam: BamFile

  protected sequenceAdapter?: BaseFeatureDataAdapter

  private samHeader: Header = {}

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
  ) {
    super(config)

    // note that derived classes may not provide a BAM directly
    // so this is conditional
    this.configure(config, getSubAdapter)
  }

  // derived classes may not use the same configuration so a custom
  // configure method allows derived classes to override this behavior
  protected configure(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
  ) {
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

  async getHeader(opts?: BaseOptions) {
    return this.bam.getHeaderText(opts)
  }

  private async setup(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    if (Object.keys(this.samHeader).length === 0) {
      statusCallback('Downloading index')
      const samHeader = await this.bam.getHeader(opts)

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
      statusCallback('')
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

    const features = refSeqStore.getFeatures({
      refName,
      start,
      end,
      assemblyName: '',
    })

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
    opts?: BaseOptions,
  ) {
    const { refName, start, end, originalRefName } = region
    const { signal, statusCallback = () => {} } = opts || {}
    return ObservableCreate<Feature>(async observer => {
      await this.setup(opts)
      statusCallback('Downloading alignments')
      const records = await this.bam.getRecordsForRange(
        refName,
        start,
        end,
        opts,
      )
      checkAbortSignal(signal)

      for (const record of records) {
        let ref: string | undefined
        if (!record.get('md')) {
          // eslint-disable-next-line no-await-in-loop
          ref = await this.seqFetch(
            originalRefName || refName,
            record.get('start'),
            record.get('end'),
          )
        }
        observer.next(new BamSlightlyLazyFeature(record, this, ref))
      }
      statusCallback('')
      observer.complete()
    }, signal)
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
