import { NoAssemblyRegion } from '../../util'
import { BaseOptions } from './types'
import { RegionsAdapter } from '../BaseAdapter'
import { BaseFeatureDataAdapter } from './BaseFeatureDataAdapter'

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
