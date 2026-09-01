import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type {
  GatedFetchArgs,
  RegionTooLargeResult,
} from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

export interface ArcFeaturesResult {
  features: SimpleFeatureSerialized[]
  /**
   * What the index quoted for the largest of `regions`, carried back whether or
   * not it was under budget — the display's gate stamps it either way, and a
   * measurement it never sees is one the banner cannot release from.
   */
  bytes?: number
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    ArcGetFeatures: {
      args: GatedFetchArgs & {
        adapterConfig: Record<string, unknown>
        // supplied by renameRegionsIfNeeded during serialization, never by a
        // caller
        sequenceAdapter?: Record<string, unknown>
        regions: Region[]
      }
      return: ArcFeaturesResult | RegionTooLargeResult
    }
  }
}

/**
 * Arc's own feature fetch, which is `CoreGetFeatures` plus the byte gate: the
 * index estimate is the first await, so a region over budget is refused before
 * any arc's endpoints are downloaded. Arc read `CoreGetFeatures` until the gate
 * collapsed onto one measurement path — that method serves eight callers, none
 * of the others gated, and widening its return to a union for one of them would
 * have made every caller narrow a case it cannot receive.
 */
export default class ArcGetFeatures extends RpcMethodTypeWithRenameRegions<'ArcGetFeatures'> {
  name = 'ArcGetFeatures' as const

  async execute(args: RpcExecuteArgs<'ArcGetFeatures'>) {
    const { executeArcGetFeatures } = await import('./executeArcGetFeatures.ts')
    return executeArcGetFeatures({ pluginManager: this.pluginManager, args })
  }
}
