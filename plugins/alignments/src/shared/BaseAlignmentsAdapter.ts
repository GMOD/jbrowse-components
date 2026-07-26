import {
  BaseFeatureDataAdapter,
  isSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

/**
 * What every adapter feeding an AlignmentsTrack needs regardless of container
 * format: the enclosing assembly's sequence adapter, memoized, for records that
 * carry no MD tag and so can only be compared against the reference.
 */
export abstract class BaseAlignmentsAdapter<
  CONF extends AnyConfigurationModel,
> extends BaseFeatureDataAdapter<CONF> {
  private sequenceAdapterP?: Promise<BaseSequenceAdapter | undefined>

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
