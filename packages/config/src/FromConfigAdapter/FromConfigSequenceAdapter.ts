import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { INoAssemblyRegion } from '@gmod/jbrowse-core/mst-types'
import { map, toArray } from 'rxjs/operators'
import FromConfigAdapter from './FromConfigAdapter'

/**
 * Adapter that just returns the features defined in its `features` configuration
 * key, like:
 *   "features": [ { "refName": "ctgA", "start":1, "end":20 }, ... ]
 */

export default class FromSequenceConfigAdapter extends FromConfigAdapter {
  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @param {AbortSignal} [signal] optional AbortSignal for aborting the request
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeatures(region: INoAssemblyRegion) {
    const { start, end } = region
    // return ObservableCreate<Feature>(async observer => {

    return ObservableCreate<Feature>(async observer => {
      const feats = await super.getFeatures(region).pipe(toArray()).toPromise()
      const feat = feats[0]
      observer.next(
        new SimpleFeature({
          data: {
            ...feat.toJSON(),
            seq: feat.get('seq').slice(start, end),
            end,
            start,
          },
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
