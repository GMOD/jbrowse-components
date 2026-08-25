import { dedupe, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { installGlobalFetchAutorun } from '@jbrowse/display-kit/installGlobalFetchAutorun'

import { installKeyedFetch } from './installKeyedFetch.ts'
import { laneGeneFeatures } from './layoutMultiWay.ts'

import type {
  LaneGenesFetchSpec,
  LaneLinksFetchSpec,
  LaneRegion,
  MultiWaySyntenyDisplayModel,
} from './model.ts'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { GlobalFetchPhases } from '@jbrowse/display-kit/installGlobalFetchAutorun'

interface MultiWayFetchArgs {
  regions: ContentBlock[]
}

// the debounce on both dependent fetches: they are derived from lane frames
// that move on every pan, and a frame settles well inside this
const DEPENDENT_FETCH_DELAY = 500

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

async function laneRegions(
  session: AbstractSessionModel,
  assemblyName: string,
  regions: LaneRegion[],
) {
  const assembly = await session.assemblyManager
    .waitForAssembly(assemblyName)
    .catch(() => undefined)
  return regions.map(r => ({
    ...r,
    refName: assembly?.getCanonicalRefName2(r.refName) ?? r.refName,
  }))
}

export function doAfterAttach(self: MultiWaySyntenyDisplayModel) {
  installGlobalFetchAutorun(self, {
    ...fetchPhases(self),
    delay: 1000,
    name: 'MultiWaySyntenyFetch',
  })

  // the second, dependent fetch: once the ortholog groups have settled into
  // lane frames, pull each lane's gene models from that assembly's own gene
  // track
  installKeyedFetch<LaneGenesFetchSpec, Feature[]>(self, {
    name: 'MultiWayLaneGenes',
    delay: DEPENDENT_FETCH_DELAY,
    specsOf: () => self.laneGenesFetchSpecs,
    fetchOne: async (spec, stopToken) => {
      const session = getSession(self)
      const features = await session.rpcManager.call(
        getRpcSessionId(self),
        'CoreGetFeatures',
        {
          adapterConfig: spec.adapterConfig,
          regions: await laneRegions(session, spec.assemblyName, spec.regions),
          stopToken,
          // a deliberate no-op: the lane fetch refines a track that is already
          // drawn, and holds displayPhase at loading while it runs, so there is
          // no second bar to feed
          statusCallback: () => {},
        },
      )
      return [spec.assemblyName, laneGeneFeatures(features)] as const
    },
    commit: (key, entries) => {
      self.setLaneGenes(key, entries)
    },
  })

  // the third fetch, for alignment-level sources: the direct records between
  // each ADJACENT mate-lane pair, out of the same all-vs-all track. The specs
  // exist only when the source names no genes, so a gene table never issues
  // these.
  installKeyedFetch<LaneLinksFetchSpec, Feature[]>(self, {
    name: 'MultiWayLaneLinks',
    delay: DEPENDENT_FETCH_DELAY,
    specsOf: () => self.laneLinksFetchSpecs,
    fetchOne: async (spec, stopToken) => {
      const session = getSession(self)
      const features = await session.rpcManager.call(
        getRpcSessionId(self),
        'CoreGetFeatures',
        {
          adapterConfig: self.adapterConfig,
          regions: await laneRegions(session, spec.region.assemblyName, [
            spec.region,
          ]),
          opts: { targetAssemblyName: spec.lowerAssembly },
          stopToken,
          statusCallback: () => {},
        },
      )
      return [`${spec.upperAssembly}|${spec.lowerAssembly}`, features] as const
    },
    commit: (key, entries) => {
      self.setLaneLinks(key, entries)
    },
  })
}
