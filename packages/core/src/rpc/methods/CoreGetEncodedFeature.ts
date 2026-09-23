import { getFeatureAdapterOrThrow } from '../../data_adapters/getFeatureAdapter.ts'
import RpcMethodTypeWithRenameRegion from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegion.ts'
import { layerFeatures } from './layerFeatures.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

/**
 * The feature behind one instance of a `CoreEncodeFeatures` answer: the same
 * request run again, and the entry of `layer`'s list the instance's
 * `featureIndex` names. A display holds channels and no records, and two reads
 * sharing a span, a run counted inside one facet section or a mark whose `x` is
 * not `start` are each a feature no coordinate lookup finds.
 */
export default class CoreGetEncodedFeature extends RpcMethodTypeWithRenameRegion<'CoreGetEncodedFeature'> {
  name = 'CoreGetEncodedFeature' as const

  async execute(args: RpcExecuteArgs<'CoreGetEncodedFeature'>) {
    const { sessionId, adapterConfig, sequenceAdapter, layer, featureIndex } =
      args
    const asked = args.layers[layer]
    if (!asked) {
      return undefined
    }
    const { pluginManager } = this
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
    })
    // A layer's list does not depend on its neighbours, so only the one asked
    // about runs its steps.
    const { layers } = await layerFeatures(
      dataAdapter,
      { ...args, layers: [asked] },
      pluginManager.jexl,
    )
    return layers[0]?.features[featureIndex]?.toJSON()
  }
}
