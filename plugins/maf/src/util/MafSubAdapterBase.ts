import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { subscribeToObservable } from '@jbrowse/core/util/rxjs'

import { MafAdapterBase } from './MafAdapterBase.ts'

import type { MafBlockSink } from './mafBlockSink.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

/** What parses one sub-adapter feature's packed MAF text into a sink. */
export interface MafTextBlockReader {
  read(
    sink: MafBlockSink,
    id: string,
    start: number,
    end: number,
    text: string,
  ): void
  reportUnmatched(): void
}

/**
 * Written out rather than inferred: the setup closure passes `this`, so
 * inferring the field's type would need the class's own type (TS7022).
 */
type SubAdapterLoader = (
  opts?: BaseOptions,
) => Promise<{ adapter: BaseFeatureDataAdapter }>

/**
 * A MAF adapter that reads its alignment file through a sub-adapter (BigBed for
 * bigMaf, BedTabix for a maf2bed BED), one block per sub-adapter feature. The
 * index, the ref names, the byte estimate for the fetch gate and the header are
 * the sub-adapter's, so a whole-chromosome read is byte-gated like any indexed
 * track.
 */
export abstract class MafSubAdapterBase<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
> extends MafAdapterBase<CONF> {
  /** The sub-adapter's config, stated from this adapter's location slots. */
  protected abstract subAdapterConfig(): Record<string, unknown>

  protected abstract blockReader(
    query: Region,
    opts?: BaseOptions,
  ): Promise<MafTextBlockReader>

  /** The packed MAF text a sub-adapter feature holds. */
  protected abstract blockText(feature: Feature): string

  private configure: SubAdapterLoader = cachedSetup({
    label: 'Downloading index',
    setup: async () => {
      if (!this.getSubAdapter) {
        throw new Error('no getSubAdapter available')
      }
      const { dataAdapter } = await this.getSubAdapter(this.subAdapterConfig())
      return { adapter: dataAdapter as BaseFeatureDataAdapter }
    },
  })

  async getRefNames(opts?: BaseOptions) {
    const { adapter } = await this.configure(opts)
    return adapter.getRefNames()
  }

  async getHeader(opts?: BaseOptions) {
    const { adapter } = await this.configure(opts)
    return adapter.getHeader()
  }

  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    const { adapter } = await this.configure(opts)
    return adapter.getRegionByteSize(regions, opts)
  }

  override async readBlocks(
    query: Region,
    sink: MafBlockSink,
    opts?: BaseOptions,
  ) {
    const { adapter } = await this.configure(opts)
    const reader = await this.blockReader(query, opts)
    await subscribeToObservable(adapter.getFeatures(query, opts), feature => {
      reader.read(
        sink,
        feature.id(),
        feature.get('start'),
        feature.get('end'),
        this.blockText(feature),
      )
    })
    reader.reportUnmatched()
  }
}
