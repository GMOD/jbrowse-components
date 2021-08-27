import { IndexedFasta } from '@gmod/indexedfasta'
import {
  BaseFeatureDataAdapter,
  SequenceAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { FileLocation, NoAssemblyRegion } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import AbortablePromiseCache from 'abortable-promise-cache'
import LRU from '@jbrowse/core/util/QuickLRU'
import PluginManager from '@jbrowse/core/PluginManager'

export default class extends BaseFeatureDataAdapter implements SequenceAdapter {
  protected fasta: typeof IndexedFasta

  private seqCache = new AbortablePromiseCache({
    cache: new LRU({ maxSize: 200 }),
    fill: async (
      args: { refName: string; start: number; end: number },
      signal?: AbortSignal,
    ) => {
      const { refName, start, end } = args
      return this.fasta.getSequence(refName, start, end, { ...args, signal })
    },
  })

  public constructor(
    config: AnyConfigurationModel,
    pluginManager: PluginManager,
  ) {
    super(config, pluginManager)
    const fastaLocation = readConfObject(config, 'fastaLocation')
    const faiLocation = readConfObject(config, 'faiLocation')
    const fastaOpts = {
      fasta: openLocation(fastaLocation as FileLocation, this.pluginManager),
      fai: openLocation(faiLocation as FileLocation, this.pluginManager),
    }

    this.fasta = new IndexedFasta(fastaOpts)
  }

  public getRefNames(opts?: BaseOptions) {
    return this.fasta.getSequenceNames(opts)
  }

  public async getRegions(opts?: BaseOptions) {
    const seqSizes = await this.fasta.getSequenceSizes(opts)
    return Object.keys(seqSizes).map(refName => ({
      refName,
      start: 0,
      end: seqSizes[refName],
    }))
  }

  /**
   * Fetch features for a certain region
   * @param param -
   * @returns Observable of Feature objects in the region
   */
  public getFeatures(region: NoAssemblyRegion, opts?: BaseOptions) {
    const { refName, start, end } = region
    return ObservableCreate<Feature>(async observer => {
      const size = await this.fasta.getSequenceSize(refName, opts)
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
        chunks.push(this.seqCache.get(JSON.stringify(r), r, opts?.signal))
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
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */): void {}
}
