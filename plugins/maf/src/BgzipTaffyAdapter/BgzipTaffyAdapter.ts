import { unzip } from '@gmod/bgzf-filehandle'
import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'

import { MafTaiAdapterBase } from '../util/MafTaiAdapterBase.ts'
import { NEWLINE } from '../util/taiBlocks.ts'
import { readTaiIndex } from '../util/taiSlice.ts'
import { readTafSlice } from './tafParsing.ts'

import type { MafBlockSink } from '../util/mafBlockSink.ts'
import type { KeepBlock, MafStanzaReader } from '../util/mafStanzaReader.ts'
import type { TaiIndex, TaiSlice } from '../util/taiSlice.ts'
import type { BgzipTaffyAdapterConfig } from './configSchema.ts'

interface SetupData extends TaiIndex {
  runLengthEncodeBases: boolean
}

/**
 * Adapter for TAF (Taffy Alignment Format) files compressed with BGZIP
 * Implements streaming parsing of TAF blocks into MAF features
 *
 * TAF Format: https://github.com/ComparativeGenomicsToolkit/taffy
 */
export default class BgzipTaffyAdapter extends MafTaiAdapterBase<
  BgzipTaffyAdapterConfig,
  SetupData
> {
  // Not private: `BgzipTaffyAdapter.test.ts` asserts the header read resolves
  // the whole setup, and no public method reports `runLengthEncodeBases`.
  configure = cachedSetup({
    label: 'Downloading index',
    setup: opts => this.doSetup(opts.signal),
  })

  protected dataLocation() {
    return this.getConf('tafGzLocation')
  }

  protected readSlice(
    slice: TaiSlice,
    { runLengthEncodeBases }: SetupData,
    reader: MafStanzaReader,
    sink: MafBlockSink,
    keep: KeepBlock,
  ) {
    readTafSlice(slice, runLengthEncodeBases, reader, sink, keep)
  }

  async doSetup(signal?: AbortSignal): Promise<SetupData> {
    const [tai, runLengthEncodeBases] = await Promise.all([
      readTaiIndex(this.getConf('taiLocation'), this.pluginManager, signal),
      this.readHeader(signal),
    ])
    return { ...tai, runLengthEncodeBases }
  }

  /**
   * Whether the file's bases are run-length encoded, from its `#taf` header
   * line. A TAF may legitimately carry no header, and non-RLE is the right
   * answer there — so a *missing* header returns false.
   *
   * A failed **read** is not that, and used to be swallowed into the same
   * `false`. It is the one wrong answer this function can give that produces no
   * error: `parseBases` would take `"A 3 T 2"` for a literal sequence, so every
   * base of an RLE file would be silently wrong rather than the track failing.
   * Nothing was gained by absorbing it either — the read is the first 64KB of
   * the same file `getFeatures` reads its blocks from, so anything that breaks
   * it breaks them too, and `cachedSetup` clears the memo so a transient error
   * retries.
   */
  async readHeader(signal?: AbortSignal): Promise<boolean> {
    const file = openLocation(this.getConf('tafGzLocation'), this.pluginManager)
    // One bgzf block is at most 64KiB compressed, so this always spans a whole
    // one; `unzip` decodes the complete blocks and stops, ignoring the partial
    // tail.
    const buffer = await unzip(await file.read(65536, 0, { signal }))
    const firstLineEnd = buffer.indexOf(NEWLINE)
    const firstLine = new TextDecoder().decode(
      firstLineEnd === -1 ? buffer : buffer.subarray(0, firstLineEnd),
    )
    return (
      firstLine.startsWith('#taf') &&
      firstLine.includes('run_length_encode_bases:1')
    )
  }
}
