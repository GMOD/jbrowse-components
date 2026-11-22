import { declaredCircularLengths } from '../../pluggableElementTypes/models/saveTrackFileTypes/util.ts'
import { originHeadId } from '../../util/originCut.ts'

import type { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter/BaseFeatureDataAdapter.ts'
import type { BaseOptions } from '../../data_adapters/BaseAdapter/types.ts'
import type { SimpleFeatureSerializedNoId } from '../../util/simpleFeature.ts'
import type { AugmentedRegion } from '../../util/types/data.ts'

/**
 * The feature with `circularLength` on it and on each subfeature that runs
 * past the origin of a sequence its file declares circular that long, so
 * feature details wraps it there even where the assembly does not list the
 * sequence circular.
 */
function withCircularLength<T extends SimpleFeatureSerializedNoId>(
  feature: T,
  length: number | undefined,
): T {
  return length !== undefined && feature.end > length
    ? {
        ...feature,
        circularLength: length,
        subfeatures: feature.subfeatures?.map(sub =>
          withCircularLength(sub, length),
        ),
      }
    : feature
}

/**
 * The one record with `featureId` among those the adapter holds over `region`,
 * read whole across a circular origin, so a piece past the origin finds the
 * feature it was cut from, and marked with the length of a declared circular
 * sequence it crosses the origin of (`withCircularLength`). Picked in the
 * worker: every other record over the region stays there, samples and all.
 * `crossingOrigin` is that record again where it crosses such an origin, the
 * only case an adapter cut it into pieces.
 */
export async function recordAcrossOrigin(
  dataAdapter: BaseFeatureDataAdapter,
  region: AugmentedRegion,
  featureId: string,
  opts: BaseOptions,
) {
  const featuresArray = await dataAdapter.getFeaturesArray(region, {
    ...opts,
    wholeAcrossOrigin: true,
  })
  const headId = originHeadId(featureId)
  const feature =
    featuresArray.find(f => f.id() === featureId) ??
    featuresArray.find(f => f.id() === headId)
  const length =
    feature &&
    declaredCircularLengths(featuresArray).get(feature.get('refName'))
  const record = feature && withCircularLength(feature.toJSON(), length)
  return {
    feature: record,
    crossingOrigin:
      record && length !== undefined && record.end > length
        ? record
        : undefined,
  }
}
