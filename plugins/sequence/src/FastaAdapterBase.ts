import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadPhase, updateStatus } from '@jbrowse/core/util'

import { readOptionalMetadata, refSizesToRegions } from './chromSizesUtils.ts'
import { sequenceFeatures } from './sequenceFeatures.ts'

import type { IndexedFasta } from '@gmod/indexedfasta'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

/**
 * Everything IndexedFastaAdapter and BgzipFastaAdapter share, which is
 * everything but which `@gmod/indexedfasta` reader to construct and from which
 * `fileLocation` slots.
 *
 * Generic over CONF rather than fixed to the indexed schema so each concrete
 * adapter reads its own slots through its own config type — bgzip has a
 * `gziLocation` the plain indexed one does not, and typing the base to either
 * schema forces the other's reads back to `any`.
 */
export abstract class FastaAdapterBase<
  CONF extends AnyConfigurationModel,
> extends BaseSequenceAdapter<CONF> {
  protected setupP?: Promise<{ fasta: IndexedFasta }>

  abstract setupPre(): Promise<{ fasta: IndexedFasta }>

  public async setup() {
    this.setupP ??= this.setupPre().catch((e: unknown) => {
      this.setupP = undefined
      throw e
    })
    return this.setupP
  }

  // @gmod/indexedfasta does its own reads, so the phase can't be handed the URL
  // by the fetch: it comes off the config the filehandle was opened from. Path
  // form because CONF is unresolved here — see getHeader below; both schemas
  // declare the slot
  private sizesPhase() {
    return downloadPhase(
      'Downloading chromosome sizes',
      this.getConf(['faiLocation']),
    )
  }

  public async getRefNames(opts?: BaseOptions) {
    const { fasta } = await this.setup()
    return updateStatus(this.sizesPhase(), opts?.statusCallback, () =>
      fasta.getSequenceNames(),
    )
  }

  public async getRegions(opts?: BaseOptions) {
    const { fasta } = await this.setup()
    // the .fai is read lazily by @gmod/indexedfasta on first use, so the wait an
    // assembly load spends here is that download. It exposes no byte callback,
    // so this is an indeterminate phase label rather than a bar
    return refSizesToRegions(
      await updateStatus(this.sizesPhase(), opts?.statusCallback, () =>
        fasta.getSequenceSizes(),
      ),
    )
  }

  public async getHeader() {
    // path form because CONF is unresolved here, so the slot-name overload has
    // nothing to check the literal against. Both schemas declare the slot; the
    // value goes straight into a FileLocation parameter
    return readOptionalMetadata(
      this.getConf(['metadataLocation']),
      this.pluginManager,
    )
  }

  /**
   * Asks the reader for exactly the region requested. **Do not reintroduce a
   * sequence cache here** — this used to round every request out to a 128kb
   * chunk and memoize it in a 200-entry LRU, and it was measured a loss.
   *
   * The reuse it was providing already exists one layer down:
   * `RemoteFileWithRangeCache` caches 256 KiB of raw bytes per chunk, module-wide
   * across every adapter instance, with in-flight dedup and a 15-minute idle
   * sweep, and every URI location goes through it (an internet account's
   * `openLocation` returns one too). Measured over 100 pan steps of a reference
   * sequence track at 1bp/px on a 30Mb contig, both come to a single read, and
   * the chunk cache's whole contribution was 0.3ms of skipped decode — 0.003ms
   * per step. What it cost was real: up to ~51MB of decoded sequence retained per
   * adapter instance with no expiry (quick-lru holds 2x maxSize), and 300
   * scattered 200bp lookups reading 22.9MB instead of 0.06MB, 3x slower. It also
   * lost on contiguous 100kb walks — CRAM's per-slice reference fetch — because
   * requests that straddle a chunk boundary fetch two.
   */
  public getFeatures(region: NoAssemblyRegion, opts?: BaseOptions) {
    return sequenceFeatures(
      region,
      opts,
      async () => (await this.setup()).fasta,
    )
  }
}
