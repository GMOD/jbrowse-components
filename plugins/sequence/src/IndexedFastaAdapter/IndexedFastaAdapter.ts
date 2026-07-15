import { IndexedFasta } from '@gmod/indexedfasta'
import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, updateStatus } from '@jbrowse/core/util'
import QuickLRU from '@jbrowse/core/util/QuickLRU'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { readOptionalMetadata, refSizesToRegions } from '../chromSizesUtils.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class IndexedFastaAdapter extends BaseSequenceAdapter {
  protected setupP?: Promise<{ fasta: IndexedFasta }>

  // memoizes fixed-size sequence chunks so overlapping/adjacent region requests
  // reuse already-fetched sequence; stores the promise so concurrent identical
  // requests dedupe, and evicts on failure so a transient error can be retried
  private seqCache = new QuickLRU<string, Promise<string | undefined>>({
    maxSize: 200,
  })

  private getChunk(refName: string, start: number, end: number) {
    const key = `${refName}-${start}-${end}`
    const cached = this.seqCache.get(key)
    if (cached) {
      return cached
    } else {
      const p = this.setup().then(({ fasta }) =>
        fasta.getSequence(refName, start, end),
      )
      this.seqCache.set(key, p)
      p.catch(() => {
        this.seqCache.delete(key)
      })
      return p
    }
  }

  public async getRefNames(_opts?: BaseOptions) {
    const { fasta } = await this.setup()
    return fasta.getSequenceNames()
  }

  public async getRegions(_opts?: BaseOptions) {
    const { fasta } = await this.setup()
    return refSizesToRegions(await fasta.getSequenceSizes())
  }

  public async setupPre() {
    return {
      fasta: new IndexedFasta({
        fasta: openLocation(this.getConf('fastaLocation'), this.pluginManager),
        fai: openLocation(this.getConf('faiLocation'), this.pluginManager),
      }),
    }
  }

  public async getHeader() {
    return readOptionalMetadata(
      this.getConf('metadataLocation'),
      this.pluginManager,
    )
  }

  public async setup() {
    this.setupP ??= this.setupPre().catch((e: unknown) => {
      this.setupP = undefined
      throw e
    })
    return this.setupP
  }

  // assembles a region's sequence from cached fixed-size chunks, clamping to
  // the contig length so the returned end is accurate past the contig edge
  private async fetchSequence(refName: string, start: number, end: number) {
    const { fasta } = await this.setup()
    const size = await fasta.getSequenceSize(refName)
    const regionEnd = size === undefined ? end : Math.min(size, end)
    const chunkSize = 128000
    const s = start - (start % chunkSize)
    const e = Math.ceil(regionEnd / chunkSize) * chunkSize
    const chunkPromises = []
    for (let chunkStart = s; chunkStart < e; chunkStart += chunkSize) {
      chunkPromises.push(
        this.getChunk(refName, chunkStart, chunkStart + chunkSize),
      )
    }
    const chunks = await Promise.all(chunkPromises)
    return {
      end: regionEnd,
      seq: chunks.join('').slice(start - s, regionEnd - s),
    }
  }

  public getFeatures(region: NoAssemblyRegion, opts?: BaseOptions) {
    const { statusCallback = () => {}, stopToken } = opts ?? {}
    const { refName, start } = region
    return ObservableCreate<Feature>(async observer => {
      await updateStatus(
        'Downloading sequence',
        statusCallback,
        async () => {
          const { seq, end } = await this.fetchSequence(
            refName,
            start,
            region.end,
          )
          checkStopToken(stopToken)
          if (seq) {
            observer.next(
              new SimpleFeature({
                id: `${refName}-${start}-${end}`,
                data: { refName, start, end, seq },
              }),
            )
          }
        },
        stopToken,
      )
      observer.complete()
    })
  }
}
