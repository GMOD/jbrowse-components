import { dedupe, getSession, isAbortException } from '@jbrowse/core/util'
import { fanOutStatus } from '@jbrowse/core/util/fetchContext'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { installGlobalFetchAutorun } from '@jbrowse/display-kit/installGlobalFetchAutorun'
import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import { laneGeneFeatures } from './geneGlyph.ts'
import { decideLaneFrames, sameDecisions } from './laneDecision.ts'

import type { LaneRegion, MultiWaySyntenyDisplayModel } from './model.ts'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { GlobalFetchPhases } from '@jbrowse/display-kit/installGlobalFetchAutorun'

interface MultiWayFetchArgs {
  regions: ContentBlock[]
}

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
 * models, so this resolves either way and the commit always happens — which is
 * also what settles `displayPhase` off `loading` when the first one lands. The
 * log guard is `handleFetchError`'s rule per lane: an abort is the ordinary end
 * of a superseded run, and a stale run's failure belongs to whatever replaced
 * it.
 */
async function fetchEachLane<Spec, Result>(
  label: string,
  specs: Spec[],
  ctx: FetchContext,
  fetchOne: (
    spec: Spec,
    ctx: FetchContext,
  ) => Promise<readonly [string, Result]>,
) {
  const perLane = fanOutStatus(ctx, specs.length)
  const settled = await Promise.allSettled(
    specs.map((spec, i) => fetchOne(spec, perLane[i]!)),
  )
  const entries: (readonly [string, Result])[] = []
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

/**
 * A SECOND fetch on this display: one that runs off the lane frames the
 * ortholog fetch produced, asks per lane, and commits under the key its specs
 * were built at.
 *
 * There are two of them and they differ only in what a lane asks for and where
 * the answer lands. Everything else here is a rule with a reason, and each was
 * worth stating once rather than twice:
 *
 * - **The delay** is the same for both because both are derived from lane
 *   frames that move on every pan, and a frame settles well inside 500ms.
 * - **The status window is the display's own, lent** rather than a channel of
 *   its own: a lane refetch runs over lanes that are already drawn, so
 *   `displayPhase` is `ready` and this reports through the corner progress chip
 *   instead of the scrim.
 * - **`prepare` answers only "is there anything to fetch".** Whether the
 *   committed result already answers these specs is the skeleton's key gate,
 *   stamped at commit and overridden on a reload — so neither pair needs a
 *   `reload()` of its own. Spelling that comparison in `prepare` instead is the
 *   dead Retry this display shipped once and `installFetch` exists to make
 *   unspellable.
 * - **No `contract`**: both are second fetches on a display whose global
 *   foundation already installed the two display-contract checks.
 * - **`setError` is a noop.** A lane's extra records are an enhancement over
 *   placement boxes that are already correct, so a lane failure must not reach
 *   the error slot the ortholog fetch owns — least of all through the clear it
 *   would do at the start of every run.
 */
function installLaneFetch<Spec, Result>(
  self: MultiWaySyntenyDisplayModel,
  {
    name,
    fetchSpecs,
    fetchOne,
    loadedKey,
    commit,
  }: {
    name: string
    fetchSpecs: () => { key: string; specs: Spec[] }
    fetchOne: (
      spec: Spec,
      ctx: FetchContext,
    ) => Promise<readonly [string, Result]>
    loadedKey: () => string | undefined
    commit: (byLane: Map<string, Result>, key: string) => void
  },
) {
  installFetch(self, {
    name,
    delay: DEPENDENT_FETCH_DELAY,
    report: { statusWindow: self.statusWindow },
    gate: () => !self.isMinimized,
    prepare: () => {
      const { key, specs } = fetchSpecs()
      return specs.length > 0 ? { key, specs } : undefined
    },
    fetchKey: ({ key }) => key,
    // the display's own stamp rather than the skeleton's, so `dataSuperseded`
    // reads the same key the gate compares
    loadedKey,
    run: ({ specs }, ctx) => fetchEachLane(name, specs, ctx, fetchOne),
    commit: (byLane, { key }) => {
      commit(byLane, key)
    },
    setError: () => {},
  })
}

/**
 * The settle-time lane decision. Reads the settled group set and the view's
 * scale, never its scroll offset: the px space every lane is aligned in is
 * anchored at the offset of the moment, read untracked, and the decision
 * itself is stated in anchor coordinates, so a pan moves the frames without
 * re-deciding anything.
 */
function installLaneFrameDecision(self: MultiWaySyntenyDisplayModel) {
  addDisposer(
    self,
    autorun(
      () => {
        const view = self.lgv
        if (!view.initialized) {
          return
        }
        const { anchorAbsX, visibleGroups, rowAssemblies } = self
        // eslint-disable-next-line no-restricted-syntax -- SELF-WRITE for the decisions this body writes back; EFFECT INPUT for the offset, which every px below is relative to and which cancels out of the decision — it only stamps the space the frames are laid out against, and tracking it would re-decide on every pan
        const { origin, previous } = untracked(() => ({
          origin: view.offsetPx,
          previous: self.laneDecisions,
        }))
        const next = decideLaneFrames({
          groups: visibleGroups,
          assemblyNames: rowAssemblies,
          anchorX: new Map(
            [...anchorAbsX].map(([key, { x }]) => [key, x - origin]),
          ),
          anchorCoordOf: group => anchorAbsX.get(group.key)!.coord,
          pxOfAnchor: coord => {
            const px = view.bpToPx(coord)
            return px && px.offsetPx - origin
          },
          unitBp: self.visibleBpSpan,
          width: self.canvasWidth,
          anchorReversed: self.anchorReversed,
          previous,
          pinned: self.pinnedLaneContigs,
        })
        if (
          // eslint-disable-next-line no-restricted-syntax -- SELF-WRITE: setLaneFrames writes it
          origin !== untracked(() => self.renderOriginPx) ||
          !sameDecisions(previous, next)
        ) {
          self.setLaneFrames(origin, next)
        }
      },
      { name: 'MultiWayLaneFrames' },
    ),
  )
}

export function doAfterAttach(self: MultiWaySyntenyDisplayModel) {
  installLaneFrameDecision(self)
  installGlobalFetchAutorun(self, {
    ...fetchPhases(self),
    delay: 1000,
    name: 'MultiWaySyntenyFetch',
  })

  // The second fetch: once the ortholog groups have settled into lane frames,
  // each lane's gene models out of that assembly's own gene track.
  installLaneFetch(self, {
    name: 'MultiWayLaneGenes',
    fetchSpecs: () => self.laneGenesFetchSpecs,
    loadedKey: () => self.laneGenesKey,
    fetchOne: async (spec, ctx) => {
      const features = await ctx.callRpc('CoreGetFeatures', {
        adapterConfig: spec.adapterConfig,
        regions: await laneRegions(
          getSession(self),
          spec.assemblyName,
          spec.regions,
        ),
      })
      return [spec.assemblyName, laneGeneFeatures(features)] as const
    },
    commit: (genes, key) => {
      self.setLaneGenes(genes, key)
    },
  })

  // The third, for alignment-level sources: the direct records between each
  // ADJACENT mate-lane pair, out of the same all-vs-all track. The specs exist
  // only when the source names no genes, so a gene table never issues these.
  installLaneFetch(self, {
    name: 'MultiWayLaneLinks',
    fetchSpecs: () => self.laneLinksFetchSpecs,
    loadedKey: () => self.laneLinksKey,
    fetchOne: async (spec, ctx) => {
      const features = await ctx.callRpc('CoreGetFeatures', {
        adapterConfig: self.adapterConfig,
        regions: await laneRegions(getSession(self), spec.region.assemblyName, [
          spec.region,
        ]),
        opts: { targetAssemblyName: spec.lowerAssembly },
      })
      return [`${spec.upperAssembly}|${spec.lowerAssembly}`, features] as const
    },
    commit: (links, key) => {
      self.setLaneLinks(links, key)
    },
  })
}
