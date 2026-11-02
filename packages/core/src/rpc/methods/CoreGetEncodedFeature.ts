import RpcMethodTypeWithRenameRegion from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegion.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

/**
 * The feature behind one instance of a `CoreGetEncodedLayers` answer: the same
 * request run again, and the row of `layer`'s table the instance's
 * `featureIndex` names, or the feature that row is a child feature of. A display holds channels and no records, and two reads
 * sharing a span, a run counted inside one facet section or a mark whose `x` is
 * not `start` are each a feature no coordinate lookup finds.
 */
export default class CoreGetEncodedFeature extends RpcMethodTypeWithRenameRegion<'CoreGetEncodedFeature'> {
  name = 'CoreGetEncodedFeature' as const

  override preload() {
    return import('./executeEncodedLayers.ts')
  }

  async execute(args: RpcExecuteArgs<'CoreGetEncodedFeature'>) {
    const { executeGetEncodedFeature } = await this.preload()
    return executeGetEncodedFeature({ pluginManager: this.pluginManager, args })
  }
}
