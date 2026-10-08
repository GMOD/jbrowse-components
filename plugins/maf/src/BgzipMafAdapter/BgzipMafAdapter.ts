import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'

import { MafAdapterBase } from '../util/MafAdapterBase.ts'
import { mafBlockFeatures } from '../util/mafFeatureSink.ts'
import { readTaiBlocks } from '../util/taiBlocks.ts'
import { readTaiIndex, taiRegionByteSize } from '../util/taiSlice.ts'
import { parseMafBlocks } from './mafParsing.ts'

import type { MafBlockSink } from '../util/mafBlockSink.ts'
import type { BgzipMafAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

/**
 * A bgzip-compressed MAF with a Taffy `.tai` index.
 *
 * This is the shape whole-genome multiple alignments are actually published in:
 * HPRC release 2 ships `hprc-v2.1-mc-grch38.full.maf.gz` (53 GB, 464
 * haplotypes) with a sibling `.tai`, and Cactus/taffy write the pair for any
 * HAL export. Nothing else here reads it — `BgzipTaffyAdapter` wants TAF,
 * `MafTabixAdapter` a maf2bed BED, `BigMafAdapter` a bigMaf — so a published
 * alignment had to be converted before it could be looked at.
 *
 * The index, the block arithmetic and the read around it are
 * `BgzipTaffyAdapter`'s, unchanged: a `.tai` describes bgzf virtual offsets
 * against reference coordinates and does not care which text format sits
 * inside. Only the body parse differs, so `readTaiBlocks` is everything but
 * that. Measured against HPRC's own index, a 10 kb locus resolves to a ~924 KB
 * read out of the 53 GB file.
 */
export default class BgzipMafAdapter extends MafAdapterBase<BgzipMafAdapterConfig> {
  private configure = cachedSetup({
    label: 'Downloading index',
    setup: opts =>
      readTaiIndex(
        this.getConf('taiLocation'),
        this.getConf('mafGzLocation'),
        this.pluginManager,
        opts.signal,
      ),
  })

  private decoder = new TextDecoder()

  async getRefNames(opts?: BaseOptions) {
    const { index } = await this.configure(opts)
    return [...index.keys()]
  }

  getFeatures(query: Region, opts?: BaseOptions) {
    return mafBlockFeatures(
      query.refName,
      sink => this.readBlocks(query, sink, opts),
      opts?.signal,
    )
  }

  override readBlocks(query: Region, sink: MafBlockSink, opts?: BaseOptions) {
    return readTaiBlocks({
      configure: this.configure,
      sampleIds: o => this.sampleIds(o),
      location: this.getConf('mafGzLocation'),
      pluginManager: this.pluginManager,
      query,
      sink,
      opts,
      parse: (slice, _setup, resolve) =>
        parseMafBlocks(this.decoder.decode(slice), resolve),
    })
  }

  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    return taiRegionByteSize(await this.configure(opts), regions)
  }
}
