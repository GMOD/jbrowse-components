import { dedupe } from '@jbrowse/core/util'
import {
  installGlobalFetchAutorun,
  onDisplayedRegionsChange,
} from '@jbrowse/plugin-linear-genome-view'

import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { Feature } from '@jbrowse/core/util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { GlobalFetchPhases } from '@jbrowse/plugin-linear-genome-view'

interface MultiWayFetchArgs {
  regions: ContentBlock[]
}

function fetchPhases(
  self: MultiWaySyntenyDisplayModel,
): GlobalFetchPhases<MultiWayFetchArgs, Feature[]> {
  return {
    prepare: () => {
      const regions = self.lgv.staticBlocks.contentBlocks
      return regions.length ? { regions } : undefined
    },
    // no targetAssemblyName: a multi-genome adapter queried with no target
    // answers with every pair anchored on the queried assembly, which is
    // exactly the row set this display draws
    run: async ({ regions }, ctx) =>
      dedupe(
        await ctx.callRpc('CoreGetFeatures', {
          regions,
          adapterConfig: self.adapterConfig,
        }),
        r => r.id(),
      ),
    commit: features => {
      self.setFeatures(features)
    },
  }
}

export function doAfterAttach(self: MultiWaySyntenyDisplayModel) {
  installGlobalFetchAutorun(self, {
    ...fetchPhases(self),
    delay: 1000,
    name: 'MultiWaySyntenyFetch',
  })
  onDisplayedRegionsChange(self, () => {
    self.clearByteEstimate()
  })
}
