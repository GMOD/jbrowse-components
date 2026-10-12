import { makeRefChrFilter } from '../BgzipTaffyAdapter/taiIndex.ts'
import { MafAdapterBase } from './MafAdapterBase.ts'
import { addParsedBlock } from './mafBlockSink.ts'
import { makeSourceResolver } from './parseAssemblyName.ts'
import { readTaiSlice, taiRegionByteSize } from './taiSlice.ts'

import type { MafBlockSink } from './mafBlockSink.ts'
import type { SourceResolver } from './parseAssemblyName.ts'
import type { TaiBlockFeature } from './taiBlocks.ts'
import type { TaiIndex } from './taiSlice.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { FileLocation, Region } from '@jbrowse/core/util'

/**
 * A bgzip file with a taffy `.tai` index. The index describes bgzf virtual
 * offsets against reference coordinates and does not care which text format
 * sits inside, so the parse is all that differs between `BgzipMafAdapter` and
 * `BgzipTaffyAdapter`.
 */
export abstract class MafTaiAdapterBase<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
  SETUP extends TaiIndex = TaiIndex,
> extends MafAdapterBase<CONF> {
  protected abstract configure: (opts?: BaseOptions) => Promise<SETUP>

  /** The bgzip file the `.tai` indexes. */
  protected abstract dataLocation(): FileLocation

  protected abstract parseBlocks(
    slice: Uint8Array,
    setup: SETUP,
    resolve: SourceResolver,
  ): Iterable<TaiBlockFeature>

  protected decoder = new TextDecoder()

  async getRefNames(opts?: BaseOptions) {
    const { index } = await this.configure(opts)
    return [...index.keys()]
  }

  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    return taiRegionByteSize(await this.configure(opts), regions)
  }

  /**
   * Overlapping the query span is not enough to keep a block: the read runs
   * past the chromosome's end by design, and a block of the next chromosome can
   * overlap numerically.
   */
  override async readBlocks(
    query: Region,
    sink: MafBlockSink,
    opts?: BaseOptions,
  ) {
    const { statusCallback, signal } = opts ?? {}
    const setup = await this.configure(opts)
    const resolver = makeSourceResolver(await this.sampleIds(opts))
    const onQueriedChr = makeRefChrFilter(query.refName)
    const slice = await readTaiSlice({
      index: setup.index,
      fileSize: setup.fileSize,
      refName: query.refName,
      start: query.start,
      end: query.end,
      location: this.dataLocation(),
      pluginManager: this.pluginManager,
      statusCallback,
      signal,
    })
    if (!slice) {
      return
    }
    for (const block of this.parseBlocks(slice, setup, resolver.resolve)) {
      if (
        block.end > query.start &&
        block.start < query.end &&
        onQueriedChr(block.refSrc)
      ) {
        addParsedBlock(sink, block)
      }
    }
    resolver.reportUnmatched()
  }
}
