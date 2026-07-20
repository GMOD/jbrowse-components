import { BaseFeatureDataAdapter } from './BaseFeatureDataAdapter.ts'

import type { AnyConfigurationModel } from '../../configuration/index.ts'
import type { NoAssemblyRegion } from '../../util/index.ts'
import type { RegionsAdapter } from '../BaseAdapter/index.ts'
import type { BaseOptions } from './types.ts'

export abstract class BaseSequenceAdapter<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
>
  extends BaseFeatureDataAdapter<CONF>
  implements RegionsAdapter
{
  // a sequence track renders the reference at any zoom and is never too large
  async getMultiRegionFeatureDensityStats() {
    return { alwaysRender: true }
  }

  /**
   * Fetches a list of 'regions' with refName, start, and extends
   */
  abstract getRegions(opts: BaseOptions): Promise<NoAssemblyRegion[]>

  /**
   * Fetches the sequence string for a given region
   * @param region - Region to fetch sequence for
   * @param opts - Adapter options
   * @returns The sequence string for the region
   */
  async getSequence(region: NoAssemblyRegion, opts?: BaseOptions) {
    const features = await this.getFeaturesArray(
      { ...region, assemblyName: '' },
      opts,
    )
    return features[0]?.get('seq') as string | undefined
  }
}
