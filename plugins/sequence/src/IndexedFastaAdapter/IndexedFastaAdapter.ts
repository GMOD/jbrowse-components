import AbortablePromiseCache from '@gmod/abortable-promise-cache'
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

interface T {
  refName: string
  start: number
  end: number
  fasta: IndexedFasta
}

export default class IndexedFastaAdapter extends BaseSequenceAdapter {
  protected setupP?: Promise<{ fasta: IndexedFasta }>

  private seqCache = new AbortablePromiseCache<T, string | undefined>({
    cache: new QuickLRU({ maxSize: 200 }),
    fill: async (args: T) => {
      const { refName, start, end, fasta } = args
      return fasta.getSequence(refName, start, end)
    },
  })

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

  public getFeatures(region: NoAssemblyRegion, opts?: BaseOptions) {
    const { statusCallback = () => {}, stopToken } = opts ?? {}
    const { refName, start, end } = region
    return ObservableCreate<Feature>(async observer => {
      await updateStatus(
        'Downloading sequence',
        statusCallback,
        async () => {
          const { fasta } = await this.setup()
          const size = await fasta.getSequenceSize(refName)
          const regionEnd = size === undefined ? end : Math.min(size, end)
          const chunkSize = 128000

          const s = start - (start % chunkSize)
          const e = Math.ceil(regionEnd / chunkSize) * chunkSize
          const chunkPromises = []
          for (let chunkStart = s; chunkStart < e; chunkStart += chunkSize) {
            const r = {
              refName,
              start: chunkStart,
              end: chunkStart + chunkSize,
            }
            chunkPromises.push(
              this.seqCache.get(`${refName}-${chunkStart}-${r.end}`, {
                ...r,
                fasta,
              }),
            )
          }
          checkStopToken(stopToken)
          const chunks = await Promise.all(chunkPromises)
          const seq = chunks.join('').slice(start - s, regionEnd - s)
          if (seq) {
            observer.next(
              new SimpleFeature({
                id: `${refName}-${start}-${regionEnd}`,
                data: {
                  refName,
                  start,
                  end: regionEnd,
                  seq,
                },
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
