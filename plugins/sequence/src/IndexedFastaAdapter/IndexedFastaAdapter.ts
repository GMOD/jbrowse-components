import AbortablePromiseCache from '@gmod/abortable-promise-cache'
import { IndexedFasta } from '@gmod/indexedfasta'
import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, updateStatus2 } from '@jbrowse/core/util'
import QuickLRU from '@jbrowse/core/util/QuickLRU'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { FileLocation, NoAssemblyRegion } from '@jbrowse/core/util/types'

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
    const seqSizes = await fasta.getSequenceSizes()
    return Object.keys(seqSizes).map(refName => ({
      refName,
      start: 0,
      end: seqSizes[refName]!,
    }))
  }

  public async setupPre() {
    const fastaLocation = this.getConf('fastaLocation') as FileLocation
    const faiLocation = this.getConf('faiLocation') as FileLocation

    return {
      fasta: new IndexedFasta({
        fasta: openLocation(fastaLocation, this.pluginManager),
        fai: openLocation(faiLocation, this.pluginManager),
      }),
    }
  }

  public async getHeader() {
    const loc = this.getConf('metadataLocation')
    return loc.uri === '' || loc.uri === '/path/to/fa.metadata.yaml'
      ? null
      : openLocation(loc, this.pluginManager).readFile('utf8')
  }

  public async setup() {
    if (!this.setupP) {
      this.setupP = this.setupPre().catch((e: unknown) => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  public getFeatures(region: NoAssemblyRegion, opts?: BaseOptions) {
    const { statusCallback = () => {}, stopToken } = opts || {}
    const { refName, start, end } = region
    return ObservableCreate<Feature>(async observer => {
      await updateStatus2(
        'Downloading sequence',
        statusCallback,
        stopToken,
        async () => {
          const { fasta } = await this.setup()
          const size = await fasta.getSequenceSize(refName)
          const regionEnd = Math.min(size || 0, end)
          const chunkSize = 128000

          const s = start - (start % chunkSize)
          const e = end + (chunkSize - (end % chunkSize))
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
          const len = end - start
          const seq = chunks.join('').slice(start - s, start - s + len)
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
      )
      observer.complete()
    })
  }
}
