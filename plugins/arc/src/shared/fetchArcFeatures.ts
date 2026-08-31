import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { SimpleFeature, dedupe } from '@jbrowse/core/util'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { Feature } from '@jbrowse/core/util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { GlobalFetchPhases } from '@jbrowse/display-kit/installGlobalFetchAutorun'

// The features plus what the fetch measured on the way to them: the shared
// commit records the bytes and hands the rest to `commit`.
interface ArcFetchResult {
  features: Feature[]
  bytes?: number
}

// The static blocks themselves, not `Region[]`: `viewSignature` keys off
// `block.key`, which is arc's whole staleness axis.
interface ArcFetchArgs {
  regions: ContentBlock[]
}

/**
 * Every arc feature for the current static blocks, as the three phases
 * `installGlobalFetchAutorun` runs them in. The gates, the byte measurement and
 * the signature stamp at commit are all that declaration's, so what is left
 * here is only what is arc's: which blocks to fetch and where the features go.
 *
 * The gate is the one argument `byteLimit`: `ArcGetFeatures` measures the index
 * before it downloads and answers a refusal instead of features when the
 * largest block is over budget, which the shared commit turns into a stamped
 * measurement and no commit.
 */
export function arcFetchPhases(
  self: ArcDisplayModel,
): GlobalFetchPhases<ArcFetchArgs, ArcFetchResult> {
  return {
    prepare: () => {
      const regions = self.host.staticBlocks.contentBlocks
      return regions.length ? { regions } : undefined
    },
    run: async ({ regions }, ctx) => {
      const result = await ctx.callRpc('ArcGetFeatures', {
        regions,
        adapterConfig: self.adapterConfig,
        byteLimit: self.resolvedByteLimit(),
      })
      return isRegionRefused(result)
        ? result
        : {
            features: dedupe(
              result.features.map(f => new SimpleFeature(f)),
              r => r.id(),
            ),
            bytes: result.bytes,
          }
    },
    commit: ({ features }) => {
      self.setFeatures(features)
    },
  }
}
