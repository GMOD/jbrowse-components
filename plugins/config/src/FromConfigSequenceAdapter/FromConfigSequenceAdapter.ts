import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import FromConfigAdapter, {
  mergeFeaturesToRegions,
} from '../FromConfigAdapter/FromConfigAdapter.ts'

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
    return ObservableCreate<Feature>(async observer => {
      const feats = await firstValueFrom(
        super.getFeatures(region).pipe(toArray()),
      )
      const feat = feats[0]
      if (!feat) {
        observer.complete()
        return
      }
      observer.next(
        new SimpleFeature({
          ...feat.toJSON(),
          uniqueId: `${feat.id()}:${region.start}-${region.end}`,
          end: region.end,
          start: region.start,
          seq: (feat.get('seq') as string)
            .slice(
              Math.max(region.start - feat.get('start'), 0),
              Math.max(region.end - feat.get('start'), 0),
            ),
        }),
      )

      observer.complete()
    })
  }

  async getRegions() {
    return mergeFeaturesToRegions(this.features)
  }
}
