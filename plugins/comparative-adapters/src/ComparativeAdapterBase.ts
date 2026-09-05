import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { createStatusFanOut } from '@jbrowse/core/util'
import { merge } from 'rxjs'
import { mergeMap } from 'rxjs/operators'

import { clipFeatureToRegion } from './clipFeatureToRegion.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

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

  /**
   * Whether a record's two intervals are the aligned extents of one alignment,
   * which `clipToRegion` may cut at a region edge on both axes, or two genes,
   * whose extents are the genes and stay whole however the region falls.
   */
  protected readonly recordsAreAlignments: boolean = true

  async hasDataForRefName() {
    return true
  }

  /**
   * `clipToRegion` is honoured here and nowhere below: `getFeatures` never sees
   * it, so an adapter composed of others (the star) clips its children's
   * records once, after its own re-keying, rather than once per child and once
   * for itself.
   */
  getFeaturesInMultipleRegions(regions: Region[], opts: BaseOptions = {}) {
    const { clipToRegion, ...rest } = opts
    const slot = createStatusFanOut(rest.statusCallback)
    return clipToRegion && this.recordsAreAlignments
      ? merge(
          ...regions.map(region =>
            this.getFeatures(region, {
              ...rest,
              statusCallback: slot(),
            }).pipe(
              mergeMap((feature): Feature[] => {
                const clipped = clipFeatureToRegion(feature, region)
                return clipped === undefined ? [] : [clipped]
              }),
            ),
          ),
        )
      : super.getFeaturesInMultipleRegions(regions, rest)
  }
}
