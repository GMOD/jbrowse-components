import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import FromConfigAdapter, {
  mergeFeaturesToRegions,
} from '../FromConfigAdapter/FromConfigAdapter.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RegionsAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class FromConfigSequenceAdapter
  extends FromConfigAdapter
  implements RegionsAdapter
{
  /**
   * Fetch features for a certain region
   * @param region - Region
   * @returns Observable of Feature objects in the region
   */
  getFeatures(region: NoAssemblyRegion) {
    const { refName, start, end } = region
    return ObservableCreate<Feature>(observer => {
      const feats = this.features.get(refName) ?? []
      const feat = feats.find(f => f.get('end') > start && f.get('start') < end)
      if (feat) {
        const featStart = feat.get('start')
        observer.next(
          new SimpleFeature({
            ...feat.toJSON(),
            uniqueId: `${feat.id()}:${start}-${end}`,
            start,
            end,
            seq: (feat.get('seq') as string).slice(
              Math.max(start - featStart, 0),
              Math.max(end - featStart, 0),
            ),
          }),
        )
      }
      observer.complete()
    })
  }

  async getRegions() {
    return mergeFeaturesToRegions(this.features)
  }

  /**
   * `BaseSequenceAdapter`'s default, which this cannot inherit — it extends
   * `FromConfigAdapter` — and which anything resolving a sequence SUB-adapter
   * requires by name: `getSequenceSubAdapter` checks for the method and refuses
   * an adapter without it, so a GC content track over a from-config assembly
   * failed with "provides no sequence".
   */
  async getSequence(region: NoAssemblyRegion, opts?: BaseOptions) {
    const features = await this.getFeaturesArray(
      { ...region, assemblyName: '' },
      opts,
    )
    return features[0]?.get('seq') as string | undefined
  }
}
