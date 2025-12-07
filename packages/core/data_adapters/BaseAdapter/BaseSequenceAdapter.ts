import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

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

  /**
   * Fetches the sequence string for a given region
   * @param region - Region to fetch sequence for
   * @param opts - Adapter options
   * @returns The sequence string for the region
   */
  async getSequence(region: NoAssemblyRegion, opts?: BaseOptions) {
    const features = await firstValueFrom(
      this.getFeatures({ ...region, assemblyName: '' }, opts).pipe(toArray()),
    )
    return features[0]?.get('seq') as string | undefined
  }
}
