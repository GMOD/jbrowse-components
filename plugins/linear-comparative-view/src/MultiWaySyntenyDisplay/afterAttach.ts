import { dedupe, getSession, isAbortException } from '@jbrowse/core/util'
import { fanOutStatus } from '@jbrowse/core/util/fetchContext'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { installGlobalFetchAutorun } from '@jbrowse/display-kit/installGlobalFetchAutorun'

import { laneGeneFeatures } from './layoutMultiWay.ts'

import type { LaneRegion, MultiWaySyntenyDisplayModel } from './model.ts'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { GlobalFetchPhases } from '@jbrowse/display-kit/installGlobalFetchAutorun'

interface MultiWayFetchArgs {
  regions: ContentBlock[]
}

// Both dependent fetches are derived from lane frames that move on every pan,
// and a frame settles well inside this. Leading edge like every fetch installer,
// so the first one is not charged the wait.
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

/**
 * One RPC per lane, concurrently, each on its own status slot so the parallel
 * calls aggregate into one bar rather than clobbering each other.
 *
 * **One lane failing is a partial result, not a failed fetch.** That lane keeps
 * the placement boxes it already draws and every other lane keeps its gene
 * models, where a rejected `Promise.all` used to drop the whole map and blank
 * them all for one assembly's missing annotation file. So this resolves either
 * way and the commit always happens — which is also what settles `displayPhase`
 * off `loading` when the first one lands.
 *
 * The log guard is `handleFetchError`'s rule applied per lane rather than per
 * fetch: an abort is the ordinary end of a superseded run, and a stale run's
 * failure belongs to whatever replaced it.
 */
async function fetchEachLane<Spec>(
  label: string,
  specs: Spec[],
  ctx: FetchContext,
  fetchOne: (
    spec: Spec,
    ctx: FetchContext,
  ) => Promise<readonly [string, Feature[]]>,
) {
  const perLane = fanOutStatus(ctx, specs.length)
  const settled = await Promise.allSettled(
    specs.map((spec, i) => fetchOne(spec, perLane[i]!)),
  )
  const entries: (readonly [string, Feature[]])[] = []
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      entries.push(result.value)
    } else if (!ctx.isStale() && !isAbortException(result.reason)) {
      console.error(
        `${label}: one lane failed, the rest still draw`,
        result.reason,
      )
    }
  }
  return new Map(entries)
}

export function doAfterAttach(self: MultiWaySyntenyDisplayModel) {
  installGlobalFetchAutorun(self, {
    ...fetchPhases(self),
    delay: 1000,
    name: 'MultiWaySyntenyFetch',
  })

  // The second fetch, dependent on the first: once the ortholog groups have
  // settled into lane frames, pull each lane's gene models from that assembly's
  // own gene track.
  //
  // Both dependent fetches take the shared skeleton, which owns what they used
  // to hand-roll between them: the latest-wins rotation and its `isCurrent`
  // (a key compared by hand says a fetch is current again after the view goes
  // away and comes back, which the rotation does not), the token released
  // however the run ends, the currency-guarded error rule, the unconditional
  // `reloadCounter` read that makes Retry reach them at all, and — through
  // `dataCurrent` — the reload that has to override their freshness gate.
  //
  // No `contract`: both are SECOND fetches on a display whose global foundation
  // already installed the two dev-only contract checks.
  installFetch(self, {
    name: 'MultiWayLaneGenes',
    delay: DEPENDENT_FETCH_DELAY,
    // The display's own window, lent rather than a channel of its own: a lane
    // refetch runs over lanes that are already drawn, so `displayPhase` is
    // `ready` and this reports through the corner progress chip instead of the
    // scrim — and it shares the window with the fetch it depends on rather than
    // opening a second writer on the same field.
    report: { statusWindow: self.statusWindow },
    gate: () => !self.isMinimized,
    // `prepare` answers only "is there anything to fetch" — no gene track for
    // any lane means no specs, and no retry should change that. Whether the
    // committed genes already answer these specs is `dataCurrent`, which the
    // skeleton overrides on a reload so this pair needs no `reload()` of its own
    prepare: () => {
      const { key, specs } = self.laneGenesFetchSpecs
      return specs.length > 0 ? { key, specs } : undefined
    },
    dataCurrent: ({ key }) => key === self.laneGenesKey,
    run: ({ specs }, ctx) =>
      fetchEachLane('MultiWayLaneGenes', specs, ctx, async (spec, laneCtx) => {
        const features = await laneCtx.callRpc('CoreGetFeatures', {
          adapterConfig: spec.adapterConfig,
          regions: await laneRegions(
            getSession(self),
            spec.assemblyName,
            spec.regions,
          ),
        })
        return [spec.assemblyName, laneGeneFeatures(features)] as const
      }),
    commit: (genes, { key }) => {
      self.setLaneGenes(key, genes)
    },
    // A lane's annotation is an enhancement over placement boxes that are
    // already correct, so a lane failure is not the display's error: `run`
    // degrades per lane and logs there, and this must not reach the error slot
    // the ortholog fetch owns — least of all through the clear it would do at
    // the start of every run
    setError: () => {},
  })

  // The third fetch, for alignment-level sources: the direct records between
  // each ADJACENT mate-lane pair, out of the same all-vs-all track. The specs
  // exist only when the source names no genes, so a gene table never issues
  // these.
  installFetch(self, {
    name: 'MultiWayLaneLinks',
    delay: DEPENDENT_FETCH_DELAY,
    report: { statusWindow: self.statusWindow },
    gate: () => !self.isMinimized,
    prepare: () => {
      const { key, specs } = self.laneLinksFetchSpecs
      return specs.length > 0 ? { key, specs } : undefined
    },
    dataCurrent: ({ key }) => key === self.laneLinksKey,
    run: ({ specs }, ctx) =>
      fetchEachLane('MultiWayLaneLinks', specs, ctx, async (spec, laneCtx) => {
        const features = await laneCtx.callRpc('CoreGetFeatures', {
          adapterConfig: self.adapterConfig,
          regions: await laneRegions(
            getSession(self),
            spec.region.assemblyName,
            [spec.region],
          ),
          opts: { targetAssemblyName: spec.lowerAssembly },
        })
        return [
          `${spec.upperAssembly}|${spec.lowerAssembly}`,
          features,
        ] as const
      }),
    commit: (links, { key }) => {
      self.setLaneLinks(key, links)
    },
    setError: () => {},
  })
}
