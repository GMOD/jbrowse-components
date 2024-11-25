import { BaseFeatureDataAdapter } from './BaseFeatureDataAdapter'
import type { BaseOptions } from './types'
import type { NoAssemblyRegion } from '../../util'
import type { RegionsAdapter } from '../BaseAdapter'

export abstract class BaseSequenceAdapter
  extends BaseFeatureDataAdapter
  implements RegionsAdapter
{
  async getMultiRegionFeatureDensityStats() {
    return { featureDensity: 0 }
  }

  /**
   * Fetches a list of 'regions' with refName, start, and extends
   */
  abstract getRegions(opts: BaseOptions): Promise<NoAssemblyRegion[]>
}
