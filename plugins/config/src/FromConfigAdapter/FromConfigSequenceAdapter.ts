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

      feats.forEach(feat => {
        const featStart = feat.get('start')
        const seqStart = start - featStart
        const seqEnd = seqStart + (end - start)
        const seq = feat
          .get('seq')
          .slice(Math.max(seqStart, 0), Math.max(seqEnd, 0))
        observer.next(
          new SimpleFeature({
            ...feat.toJSON(),
            end: region.end,
            start: region.start,
            seq,
            uniqueId: `${Math.random()}`,
          }),
        )
      })
      observer.complete()
    })
  }

  /**
   * Get refName, start, and end for all features after collapsing any overlaps
   */
  async getRegions() {
    const regions = []

    // recall: features are stored in this object sorted by start coordinate
    for (const [refName, features] of this.features) {
      let currentRegion
      for (const feature of features) {
        if (
          currentRegion &&
          currentRegion.end >= feature.get('start') &&
          currentRegion.start <= feature.get('end')
        ) {
          currentRegion.end = feature.get('end')
        } else {
          if (currentRegion) regions.push(currentRegion)
          currentRegion = {
            refName,
            start: feature.get('start'),
            end: feature.get('end'),
          }
        }
      }
      if (currentRegion) regions.push(currentRegion)
    }

    // sort the regions by refName
    regions.sort((a, b) => a.refName.localeCompare(b.refName))

    return regions
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources(/* { region } */): void {}
}
