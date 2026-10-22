import {
  BaseSequenceAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadPhase, updateStatus } from '@jbrowse/core/util'

import { refSizesToRegions } from './chromSizesUtils.ts'
import { readOptionalMetadata } from './fastaUtils.ts'
import { sequenceFeatures } from './sequenceFeatures.ts'

import type { IndexedFasta } from '@gmod/indexedfasta'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

/**
 * IndexedFastaAdapter and BgzipFastaAdapter differ only in the reader
 * `setupPre` constructs. Generic over CONF so each concrete adapter type-checks
 * its own slots, bgzip's `gziLocation` included.
 */
export abstract class FastaAdapterBase<
  CONF extends AnyConfigurationModel,
> extends BaseSequenceAdapter<CONF> {
  abstract setupPre(): Promise<{ fasta: IndexedFasta }>

  setup = cachedSetup({ setup: () => this.setupPre() })

  // path-form getConf, since CONF is unresolved here; both schemas declare the
  // slots it reads
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
    return refSizesToRegions(
      await updateStatus(this.sizesPhase(), opts?.statusCallback, () =>
        fasta.getSequenceSizes(),
      ),
    )
  }

  public async getHeader() {
    return readOptionalMetadata(
      this.getConf(['metadataLocation']),
      this.pluginManager,
    )
  }

  /**
   * No sequence cache here: `RemoteFileWithRangeCache` already reuses the
   * bytes across every adapter, and a 128kb-chunk LRU in this spot measured
   * slower on scattered and contiguous reads while holding ~51MB per adapter.
   */
  public getFeatures(region: NoAssemblyRegion, opts?: BaseOptions) {
    return sequenceFeatures(
      region,
      opts,
      async () => (await this.setup()).fasta,
    )
  }
}
