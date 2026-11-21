import { getFeatureAdapterOrThrow } from '../../data_adapters/getFeatureAdapter.ts'
import RpcMethodTypeWithRenameRegion from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegion.ts'
import { declaredCircularLengths } from '../../pluggableElementTypes/models/saveTrackFileTypes/util.ts'
import { originHeadId } from '../../util/originCut.ts'

import type { SimpleFeatureSerializedNoId } from '../../util/simpleFeature.ts'
import type { RpcExecuteArgs } from '../RpcRegistry.ts'

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
 */
export default class GetBasicFeatureDetails extends RpcMethodTypeWithRenameRegion<'GetBasicFeatureDetails'> {
  name = 'GetBasicFeatureDetails' as const

  async execute(args: RpcExecuteArgs<'GetBasicFeatureDetails'>) {
    const { sessionId, adapterConfig, featureId, region, ...opts } = args

    const dataAdapter = await getFeatureAdapterOrThrow({
      ...args,
      pluginManager: this.pluginManager,
    })

    const featuresArray = await dataAdapter.getFeaturesArray(region, {
      ...opts,
      wholeAcrossOrigin: true,
    })

    const headId = originHeadId(featureId)
    const feature =
      featuresArray.find(f => f.id() === featureId) ??
      featuresArray.find(f => f.id() === headId)

    return {
      feature:
        feature &&
        withCircularLength(
          feature.toJSON(),
          declaredCircularLengths(featuresArray).get(feature.get('refName')),
        ),
    }
  }
}
