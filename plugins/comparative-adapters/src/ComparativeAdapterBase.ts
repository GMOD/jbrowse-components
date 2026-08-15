import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * What every adapter in this plugin answers the same way.
 *
 * `hasDataForRefName` is true unconditionally because deciding it properly is a
 * `getFeatures` — and it has to be true, or BaseFeatureDataAdapter filters the
 * track out and `getFeatures` is never called at all. Eight adapters carried
 * that method and its three-line explanation verbatim.
 *
 * Only the answers that do not depend on config live here. Anything reading a
 * slot stays in the concrete adapter, for the reason `getAssemblyNamesFromConf`
 * documents: a base generic over the config cannot prove a slot name to
 * `getConf`, so hoisting a read costs the typing that makes it worth having.
 */
export abstract class ComparativeAdapterBase<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
> extends BaseFeatureDataAdapter<CONF> {
  public static capabilities = ['getFeatures', 'getRefNames']

  async hasDataForRefName() {
    return true
  }
}
