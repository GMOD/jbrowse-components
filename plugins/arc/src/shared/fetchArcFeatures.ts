import { dedupe, getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import { regionSignature } from './regionSignature.ts'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { Feature } from '@jbrowse/core/util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type {
  GlobalFetchPhases,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// The static blocks themselves, not `Region[]`: `regionSignature` keys off
// `block.key`, which is arc's whole staleness axis.
interface ArcFetchArgs {
  regions: ContentBlock[]
}

/**
 * Every arc feature for the current static blocks, as the three phases
 * `installGlobalFetchAutorun` runs them in. Structured like LD's global fetch:
 * probe the compressed byte size (CoreGetRegionByteEstimate), commit it, and let
 * the DERIVED regionTooLarge getter (ArcFetchModel) decide — no imperative flag,
 * no bespoke gating.
 *
 * `regionTooLarge` is deliberately not a term in `prepare`: the skeleton owns
 * that skip, and it lets a blocked display run this once per settled viewport so
 * the pre-flight can re-measure. That costs an index read and returns before any
 * features are fetched.
 */
export function arcFetchPhases(
  self: ArcDisplayModel,
): GlobalFetchPhases<ArcFetchArgs, Feature[]> {
  return {
    prepare: () => {
      // `dataCurrent` is the gate and reads the same static blocks, so panning
      // past a block boundary refetches while a redundant pan within the loaded
      // blocks does not.
      const view = getContainingView(self) as LinearGenomeViewModel
      const regions = view.staticBlocks.contentBlocks
      return self.isMinimized || self.dataCurrent || !regions.length
        ? undefined
        : { regions }
    },
    run: async ({ regions }, ctx) =>
      // RegionTooLargeMixin's shared pre-flight gate, called directly because
      // arc fetches through GlobalFetchMixin rather than
      // MultiRegionDisplayMixin's fetchRegions. Blocking it means there is
      // nothing to commit.
      (await self.byteGateBlocksFetch(regions, ctx))
        ? undefined
        : dedupe(
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
    commit: (features, { regions }) => {
      self.setFeatures(features, regionSignature(regions))
    },
  }
}
