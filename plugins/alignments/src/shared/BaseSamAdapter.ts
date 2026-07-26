import {
  BaseFeatureDataAdapter,
  cachedSetup,
  isSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'

import { parseSamHeader } from './util.ts'

import type { ParsedSamHeader, SamHeaderLine } from './util.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'

/**
 * The spine BamAdapter and CramAdapter share: download the header + index
 * exactly once (label gated to the first download, byte progress threaded to
 * the index reader), expose the parsed SAM header, and memoize the optional
 * reference-sequence sub-adapter.
 */
export abstract class BaseSamAdapter<
  CONF extends AnyConfigurationModel,
> extends BaseFeatureDataAdapter<CONF> {
  public samHeader?: ParsedSamHeader

  private sequenceAdapterP?: Promise<BaseSequenceAdapter | undefined>

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

  /**
   * The assembly's sequence adapter, when one is configured and actually serves
   * sequence — a ChromSizesAdapter is a legitimate assembly adapter with no
   * getSequence, and reading through it would throw rather than degrade to "no
   * reference available".
   */
  async getSequenceAdapter() {
    const config = this.sequenceAdapterConfig
    if (config && this.getSubAdapter) {
      this.sequenceAdapterP ??= this.getSubAdapter(config)
        .then(({ dataAdapter }) =>
          isSequenceAdapter(dataAdapter) ? dataAdapter : undefined,
        )
        .catch((e: unknown) => {
          this.sequenceAdapterP = undefined
          throw e
        })
    }
    return this.sequenceAdapterP
  }
}
