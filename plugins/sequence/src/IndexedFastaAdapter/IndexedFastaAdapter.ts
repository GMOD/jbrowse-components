import { IndexedFasta } from '@gmod/indexedfasta'
import {
  BaseSequenceAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { FileLocation, NoAssemblyRegion } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { SimpleFeature, Feature } from '@jbrowse/core/util'
import AbortablePromiseCache from 'abortable-promise-cache'
import QuickLRU from '@jbrowse/core/util/QuickLRU'

type T = { refName: string; start: number; end: number; fasta: IndexedFasta }

export default class extends BaseSequenceAdapter {
  protected setupP?: Promise<{ fasta: IndexedFasta }>

  private seqCache = new AbortablePromiseCache<T, string | undefined>({
    cache: new QuickLRU({ maxSize: 200 }),
    fill: async (args: T, signal?: AbortSignal) => {
      const { refName, start, end, fasta } = args
      return fasta.getSequence(refName, start, end, { ...args, signal })
    },
  })

  public async getRefNames(opts?: BaseOptions) {
    const { fasta } = await this.setup()
    return fasta.getSequenceNames(opts)
  }

  public async getRegions(opts?: BaseOptions) {
    const { fasta } = await this.setup()
    const seqSizes = await fasta.getSequenceSizes(opts)
    return Object.keys(seqSizes).map(refName => ({
      refName,
      start: 0,
      end: seqSizes[refName],
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
      this.setupP = this.setupPre().catch(e => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  public getFeatures(region: NoAssemblyRegion, opts?: BaseOptions) {
    const { refName, start, end } = region
    return ObservableCreate<Feature>(async observer => {
      const { fasta } = await this.setup()
      const size = await fasta.getSequenceSize(refName, opts)
      const regionEnd = size !== undefined ? Math.min(size, end) : end
      const chunks = []
      const chunkSize = 128000

      const s = start - (start % chunkSize)
      const e = end + (chunkSize - (end % chunkSize))
      for (let chunkStart = s; chunkStart < e; chunkStart += chunkSize) {
        const r = {
          refName,
          start: chunkStart,
          end: chunkStart + chunkSize,
        }
        chunks.push(
          this.seqCache.get(JSON.stringify(r), { ...r, fasta }, opts?.signal),
        )
      }
      const seq = (await Promise.all(chunks))
        .join('')
        .slice(start - s)
        .slice(0, end - start)
      if (seq) {
        observer.next(
          new SimpleFeature({
            id: `${refName} ${start}-${regionEnd}`,
            data: { refName, start, end: regionEnd, seq },
          }),
        )
      }
      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the foreseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */): void {}
}
