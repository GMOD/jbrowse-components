import { dedupe, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { Feature } from '@jbrowse/core/util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { GlobalFetchPhases } from '@jbrowse/plugin-linear-genome-view'

// The static blocks themselves, not `Region[]`: `viewSignature` keys off
// `block.key`, which is arc's whole staleness axis.
interface ArcFetchArgs {
  regions: ContentBlock[]
}

/**
 * Every arc feature for the current static blocks, as the three phases
 * `installGlobalFetchAutorun` runs them in. The shared gates — minimized,
 * data-current, the byte-gate pre-flight, the signature stamp at commit — live
 * in `runGlobalFetch`, so what is left here is only what is arc's: which blocks
 * to fetch and where the features go.
 */
export function arcFetchPhases(
  self: ArcDisplayModel,
): GlobalFetchPhases<ArcFetchArgs, Feature[]> {
  return {
    prepare: () => {
      const regions = self.lgv.staticBlocks.contentBlocks
      return regions.length ? { regions } : undefined
    },
    run: async ({ regions }, ctx) =>
      dedupe(
        await getSession(self).rpcManager.call(
          getRpcSessionId(self),
          'CoreGetFeatures',
          {
            regions,
            adapterConfig: self.adapterConfig,
            stopToken: ctx.stopToken,
            statusCallback: ctx.statusCallback,
          },
        ),
        r => r.id(),
      ),
    commit: features => {
      self.setFeatures(features)
    },
  }
}
