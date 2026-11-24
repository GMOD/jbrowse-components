import { BaseFeatureDataAdapter } from './BaseFeatureDataAdapter.ts'

import type { AnyConfigurationModel } from '../../configuration/index.ts'
import type { NoAssemblyRegion } from '../../util/index.ts'
import type { RegionsAdapter } from '../BaseAdapter/index.ts'
import type { SequenceRegion } from './RegionsAdapter.ts'
import type { BaseOptions } from './types.ts'

/** #adapterBase BaseSequenceAdapter | a region list plus the sequence for a queried region; extends the feature adapter */
export abstract class BaseSequenceAdapter<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
>
  extends BaseFeatureDataAdapter<CONF>
  implements RegionsAdapter
{
  // No getRegionByteSize: a sequence adapter caps what it returns at screen
  // resolution, so it reports no byte estimate. An adapter computing from the
  // sequence (GC content, the reference scans) reads every base it is asked
  // for, so it answers one byte per base and is gated.

  /**
   * Fetches a list of 'regions' with refName, start, and extends
   */
  abstract getRegions(opts: BaseOptions): Promise<SequenceRegion[]>

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
