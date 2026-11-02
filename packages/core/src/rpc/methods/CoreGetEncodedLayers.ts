import RpcMethodTypeWithRenameRegion from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegion.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

/**
 * Fetch a region's features once, run the shared transform steps over them,
 * split them by the facet where the request names one, run each layer's own
 * steps (per section, under a facet), and evaluate the layer's encoding over
 * what is left in the worker, where the `Feature` objects are, filling the
 * lanes its mark reads. The colors come back packed, the scale tables
 * resolved, and the main thread reads the same table for its legend that the
 * colors were drawn from.
 */
export default class CoreGetEncodedLayers extends RpcMethodTypeWithRenameRegion<'CoreGetEncodedLayers'> {
  name = 'CoreGetEncodedLayers' as const

  override preload() {
    return import('./executeEncodedLayers.ts')
  }

  async execute(args: RpcExecuteArgs<'CoreGetEncodedLayers'>) {
    const { executeGetEncodedLayers } = await this.preload()
    return executeGetEncodedLayers({ pluginManager: this.pluginManager, args })
  }
}
