import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'

import { MafTaiAdapterBase } from '../util/MafTaiAdapterBase.ts'
import { readTaiIndex } from '../util/taiSlice.ts'
import { readMafBlocks } from './mafParsing.ts'

import type { MafBlockSink } from '../util/mafBlockSink.ts'
import type { KeepBlock, MafStanzaReader } from '../util/mafStanzaReader.ts'
import type { BgzipMafAdapterConfig } from './configSchema.ts'

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
 * inside. Only the body parse differs, so `MafTaiAdapterBase` is everything
 * but that. Measured against HPRC's own index, a 10 kb locus resolves to a ~924 KB
 * read out of the 53 GB file.
 */
export default class BgzipMafAdapter extends MafTaiAdapterBase<BgzipMafAdapterConfig> {
  protected configure = cachedSetup({
    label: 'Downloading index',
    setup: opts =>
      readTaiIndex(
        this.getConf('taiLocation'),
        this.getConf('mafGzLocation'),
        this.pluginManager,
        opts.signal,
      ),
  })

  protected dataLocation() {
    return this.getConf('mafGzLocation')
  }

  protected readSlice(
    slice: Uint8Array,
    _setup: unknown,
    reader: MafStanzaReader,
    sink: MafBlockSink,
    keep: KeepBlock,
  ) {
    readMafBlocks(this.decoder.decode(slice), reader, sink, keep)
  }
}
