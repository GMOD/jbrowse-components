import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { toArray } from 'rxjs/operators'
import FromConfigAdapter from './FromConfigAdapter'

export default class FromSequenceConfigAdapter extends FromConfigAdapter {
  /**
   * Fetch features for a certain region
   * @param region - Region
   * @returns Observable of Feature objects in the region
   */
  getFeatures(region: NoAssemblyRegion) {
    const { start, end } = region
    // TODO: restore commented version below once TSDX supports Rollup v2
    // xref: https://github.com/rollup/rollup/blob/master/CHANGELOG.md#bug-fixes-45
    const superGetFeatures = super.getFeatures
    return ObservableCreate<Feature>(async observer => {
      const feats = await superGetFeatures
        .call(this, region)
        .pipe(toArray())
        .toPromise()
      // return ObservableCreate<Feature>(async observer => {
      //   const feats = await super.getFeatures(region).pipe(toArray()).toPromise()
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
