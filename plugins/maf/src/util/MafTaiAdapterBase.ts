import { makeRefChrFilter } from '../BgzipTaffyAdapter/taiIndex.ts'
import { MafAdapterBase } from './MafAdapterBase.ts'
import { MafStanzaReader } from './mafStanzaReader.ts'
import { makeSourceResolver } from './parseAssemblyName.ts'
import { readTaiSlice, taiRegionByteSize } from './taiSlice.ts'

import type { MafBlockSink } from './mafBlockSink.ts'
import type { KeepBlock } from './mafStanzaReader.ts'
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

  /** The slice's blocks through `reader` into `sink`, those `keep` wants. */
  protected abstract readSlice(
    slice: Uint8Array,
    setup: SETUP,
    reader: MafStanzaReader,
    sink: MafBlockSink,
    keep: KeepBlock,
  ): void

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
    const reader = new MafStanzaReader(
      makeSourceResolver(await this.sampleIds(opts)),
    )
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
    this.readSlice(
      slice,
      setup,
      reader,
      sink,
      (refSrc, start, end) =>
        end > query.start && start < query.end && onQueriedChr(refSrc),
    )
    reader.reportUnmatched()
  }
}
