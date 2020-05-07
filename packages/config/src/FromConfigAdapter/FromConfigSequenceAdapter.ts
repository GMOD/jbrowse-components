import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { NoAssemblyRegion } from '@gmod/jbrowse-core/util/types'
import { toArray } from 'rxjs/operators'
import FromConfigAdapter from './FromConfigAdapter'

export default class FromSequenceConfigAdapter extends FromConfigAdapter {
  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @param {AbortSignal} [signal] optional AbortSignal for aborting the request
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeatures(region: NoAssemblyRegion) {
    const { start, end } = region
    return ObservableCreate<Feature>(async observer => {
      const feats = await super.getFeatures(region).pipe(toArray()).toPromise()
      const feat = feats[0]
      observer.next(
        new SimpleFeature({
          ...feat.toJSON(),
          seq: feat.get('seq').slice(start, end),
          end,
          start,
        }),
      )
      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources(/* { region } */): void {}
}
