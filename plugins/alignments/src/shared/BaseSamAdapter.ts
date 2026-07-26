import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'

import { BaseAlignmentsAdapter } from './BaseAlignmentsAdapter.ts'
import { parseSamHeader } from './util.ts'

import type { ParsedSamHeader, SamHeaderLine } from './util.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

/**
 * The spine BamAdapter and CramAdapter share: download the header + index
 * exactly once (label gated to the first download, byte progress threaded to
 * the index reader) and expose the parsed SAM header. The reference-sequence
 * sub-adapter comes from {@link BaseAlignmentsAdapter}, which SamAdapter — which
 * has no index to download — shares without inheriting the download spine.
 */
export abstract class BaseSamAdapter<
  CONF extends AnyConfigurationModel,
> extends BaseAlignmentsAdapter<CONF> {
  public samHeader?: ParsedSamHeader

  /**
   * Download the index and read the raw header lines, passing `onProgress` to
   * whichever read is the bulk of the transfer so the label becomes a
   * determinate bar.
   */
  protected abstract readSamHeader(
    onProgress?: (current: number, total?: number) => void,
  ): Promise<SamHeaderLine[]>

  /**
   * Awaited by every method that needs the header. Re-entry on pan/zoom returns
   * the memoized promise without re-flashing the label; a rejection clears the
   * memo so the next fetch retries (the underlying @gmod/bam and @gmod/cram
   * header/index promises self-clear on error too, so the already-opened file
   * is not left poisoned).
   */
  protected setup = cachedSetup({
    label: 'Downloading index',
    setup: async (_opts, onProgress) => {
      this.samHeader = parseSamHeader(await this.readSamHeader(onProgress))
      return this.samHeader
    },
  })

  async getRefNames(opts?: BaseOptions) {
    const { idToName } = await this.setup(opts)
    return idToName
  }

  refIdToName(refId: number) {
    return this.samHeader?.idToName[refId]
  }

  refNameToId(refName: string) {
    return this.samHeader?.nameToId[refName]
  }
}
