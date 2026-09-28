import {
  BaseFeatureDataAdapter,
  cachedSetup,
  isSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * What every adapter feeding an AlignmentsTrack needs regardless of container
 * format: the reference it was built with, resolved once, for records that
 * carry no MD tag and so can only be compared against the reference.
 */
export abstract class BaseAlignmentsAdapter<
  CONF extends AnyConfigurationModel,
> extends BaseFeatureDataAdapter<CONF> {
  /**
   * The reference this instance was built with, when it actually serves
   * sequence — a ChromSizesAdapter is a legitimate assembly adapter with no
   * getSequence, and reading through it would throw rather than degrade to "no
   * reference available". Built with none, the read throws: the request that
   * created the instance named no assembly, and a mismatch drawn against a
   * guessed reference says nothing.
   */
  getSequenceAdapter = cachedSetup({
    setup: async () => {
      const config = this.sequenceAdapterConfig
      if (!config || !this.getSubAdapter) {
        throw new Error(
          `${this.config.type} was built with no reference: the request that created it named no assembly`,
        )
      }
      const { dataAdapter } = await this.getSubAdapter(config)
      return isSequenceAdapter(dataAdapter) ? dataAdapter : undefined
    },
  })
}
