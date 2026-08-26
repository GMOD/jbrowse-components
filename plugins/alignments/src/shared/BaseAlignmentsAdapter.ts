import {
  BaseFeatureDataAdapter,
  cachedSetup,
  isSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * What every adapter feeding an AlignmentsTrack needs regardless of container
 * format: the enclosing assembly's sequence adapter, memoized, for records that
 * carry no MD tag and so can only be compared against the reference.
 */
export abstract class BaseAlignmentsAdapter<
  CONF extends AnyConfigurationModel,
> extends BaseFeatureDataAdapter<CONF> {
  /**
   * The assembly's sequence adapter, when one is configured and actually serves
   * sequence — a ChromSizesAdapter is a legitimate assembly adapter with no
   * getSequence, and reading through it would throw rather than degrade to "no
   * reference available".
   */
  getSequenceAdapter = cachedSetup({
    setup: async () => {
      const config = this.sequenceAdapterConfig
      if (!config || !this.getSubAdapter) {
        return undefined
      }
      const { dataAdapter } = await this.getSubAdapter(config)
      return isSequenceAdapter(dataAdapter) ? dataAdapter : undefined
    },
  })
}
