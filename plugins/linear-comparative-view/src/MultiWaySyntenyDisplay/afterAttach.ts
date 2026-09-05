import { dedupe, getSession, isAbortException } from '@jbrowse/core/util'
import { fanOutStatus } from '@jbrowse/core/util/fetchContext'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { installGlobalFetchAutorun } from '@jbrowse/display-kit/installGlobalFetchAutorun'
import { addDisposer } from '@jbrowse/mobx-state-tree'
import {
  installClearHoverOnSurfaceMove,
  installLodTierInfoFetch,
} from '@jbrowse/synteny-core'
import { autorun, untracked } from 'mobx'

import { laneGeneFeatures } from './geneGlyph.ts'
import { decideLaneFrames, sameDecisions } from './laneDecision.ts'
import { mergeContiguousRegions } from './layoutMultiWay.ts'
import { staleLaneSpecs, starAnchorOf } from './model.ts'

import type { FetchRegion } from './layoutMultiWay.ts'
import type {
  LaneFetchSpec,
  LaneRegion,
  MultiWaySyntenyDisplayModel,
} from './model.ts'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { GlobalFetchPhases } from '@jbrowse/display-kit/installGlobalFetchAutorun'
import type { LodTier } from '@jbrowse/synteny-core'

interface MultiWayFetchArgs {
  regions: FetchRegion[]
  lodTier: LodTier
}

const DEPENDENT_FETCH_DELAY = 500

function fetchPhases(
  self: MultiWaySyntenyDisplayModel,
): GlobalFetchPhases<MultiWayFetchArgs, Feature[]> {
  return {
    prepare: () => {
      const regions = mergeContiguousRegions(
        self.lgv.staticBlocks.contentBlocks,
      )
      return regions.length ? { regions, lodTier: self.lodTier } : undefined
    },
    // no targetAssemblyName: a multi-genome adapter queried with no target
    // answers with every pair anchored on the queried assembly, which is
    // exactly the row set this display draws. `mateShape: 'grouped'` asks an
    // adapter that can to fold those pairs per anchor before they cross the
    // RPC; `groupFeatures` reads either shape, so one that cannot is
    // unaffected. The tier is the one the key was issued at, so an indexed
    // PIF at a whole-chromosome window serves its coarse rows. `clipToRegion`
    // cuts each alignment record to the window on both axes before it crosses
    // the RPC: a lane fitted to whole liftOver chains sat at 80x the window
    run: async ({ regions, lodTier }, ctx) =>
      dedupe(
        await ctx.callRpc('CoreGetFeatures', {
          regions,
          adapterConfig: self.adapterConfig,
          opts: { mateShape: 'grouped', lodMode: lodTier, clipToRegion: true },
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
 * the placement boxes it already draws and is stamped with `empty` under the
 * key it asked for, so it reads as fetched rather than as owed, and every other
 * lane keeps its gene models; this resolves either way and the commit always
 * happens — which is also what settles `displayPhase` off `loading` when the
 * first one lands. The log guard is `handleFetchError`'s rule per lane: an
 * abort is the ordinary end of a superseded run, and a stale run's failure
 * belongs to whatever replaced it.
 */
async function fetchEachLane<Spec extends LaneFetchSpec, Result>(
  label: string,
  specs: Spec[],
  ctx: FetchContext,
  fetchOne: (spec: Spec, ctx: FetchContext) => Promise<Result>,
  empty: (spec: Spec) => Result,
) {
  const perLane = fanOutStatus(ctx, specs.length)
  const settled = await Promise.allSettled(
    specs.map((spec, i) => fetchOne(spec, perLane[i]!)),
  )
  const byLane = new Map<string, Result>()
  specs.forEach((spec, i) => {
    const result = settled[i]!
    if (result.status === 'fulfilled') {
      byLane.set(spec.lane, result.value)
    } else {
      if (!ctx.isStale() && !isAbortException(result.reason)) {
        console.error(
          `${label}: one lane failed, the rest still draw`,
          result.reason,
        )
      }
      byLane.set(spec.lane, empty(spec))
    }
  })
  return byLane
}

/**
 * A SECOND fetch on this display: one that runs off the lane frames the
 * ortholog fetch produced, asks per lane, and commits each lane under the key
 * its own spec was built at.
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
 * - **The freshness gate is per lane**, in the skeleton's predicate form: a run
 *   asks only the lanes whose held result was fetched under another key, so a
 *   pan that moves one lane's quantized window costs one RPC at 44 lanes
 *   rather than 44, and the other lanes' genes keep their identity. The
 *   compare is the skeleton's, not `prepare`'s, so a reload overrides it — the
 *   dead Retry this display shipped once — and a run the override lets through
 *   with nothing stale re-reads every lane, which is what a Retry asks for.
 * - **No `contract`**: both are second fetches on a display whose global
 *   foundation already installed the two display-contract checks.
 * - **`setError` is a noop.** A lane's extra records are an enhancement over
 *   placement boxes that are already correct, so a lane failure must not reach
 *   the error slot the ortholog fetch owns — least of all through the clear it
 *   would do at the start of every run.
 */
function installLaneFetch<Spec extends LaneFetchSpec, Result>(
  self: MultiWaySyntenyDisplayModel,
  {
    name,
    fetchSpecs,
    held,
    fetchOne,
    empty,
    commit,
  }: {
    name: string
    fetchSpecs: () => Spec[]
    held: () => ReadonlyMap<string, { key: string }> | undefined
    fetchOne: (spec: Spec, ctx: FetchContext) => Promise<Result>
    empty: (spec: Spec) => Result
    commit: (byLane: Map<string, Result>, specs: Spec[]) => void
  },
) {
  installFetch(self, {
    name,
    delay: DEPENDENT_FETCH_DELAY,
    report: { statusWindow: self.statusWindow },
    gate: () => !self.isMinimized,
    prepare: () => {
      const specs = fetchSpecs()
      return specs.length > 0
        ? { specs, stale: staleLaneSpecs(specs, held()) }
        : undefined
    },
    heldAnswers: ({ stale }) => stale.length === 0,
    run: ({ specs, stale }, ctx) =>
      fetchEachLane(
        name,
        stale.length > 0 ? stale : specs,
        ctx,
        fetchOne,
        empty,
      ),
    commit: (byLane, { specs }) => {
      commit(byLane, specs)
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
  // The viewport clear the fetch foundation installs answers the axes the VIEW
  // moves on. The lanes also relayout with the view still — a reorder, a hidden
  // lane, a pinned contig, a dependent commit — and a direct-link ribbon's
  // `targetIdx` has no groupKey to re-resolve through, so it addresses whatever
  // the rebuilt array holds at that index.
  installClearHoverOnSurfaceMove(self, {
    transform: () => self.ribbonGeometry.targets,
    clear: () => {
      self.clearHoveredFeature()
      self.clearDirectLinkClick()
    },
    name: 'MultiWayClearHoverOnLaneRelayout',
  })
  installLaneFrameDecision(self)
  installLodTierInfoFetch(self, {
    onHeader: header => {
      self.setStarAnchor(starAnchorOf(header))
    },
  })
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
    held: () => self.laneGenes,
    fetchOne: async (spec, ctx) => {
      const features = await ctx.callRpc('CoreGetFeatures', {
        adapterConfig: spec.adapterConfig,
        regions: await laneRegions(getSession(self), spec.lane, spec.regions),
      })
      return { key: spec.key, genes: laneGeneFeatures(features) }
    },
    empty: spec => ({ key: spec.key, genes: [] }),
    commit: (genes, specs) => {
      // the anchor's spec exists as soon as the view does, so a commit covers
      // a mate lane only once the ortholog fetch has framed one
      self.setLaneGenes(
        genes,
        specs.length > 1 ? self.anchorAssemblyName : undefined,
      )
    },
  })

  // The third, for alignment-level sources: the direct records between each
  // ADJACENT mate-lane pair, out of the same all-vs-all track. The specs exist
  // only when the source names no genes, so a gene table never issues these,
  // and not for a star that announced its anchor, whose pairs `pairLinks`
  // composes instead.
  installLaneFetch(self, {
    name: 'MultiWayLaneLinks',
    fetchSpecs: () => self.laneLinksFetchSpecs,
    held: () => self.laneLinks,
    fetchOne: async (spec, ctx) => {
      const links = await ctx.callRpc('CoreGetFeatures', {
        adapterConfig: self.adapterConfig,
        regions: await laneRegions(getSession(self), spec.region.assemblyName, [
          spec.region,
        ]),
        opts: {
          targetAssemblyName: spec.lowerAssembly,
          lodMode: spec.lodTier,
          clipToRegion: true,
        },
      })
      return { key: spec.key, links }
    },
    empty: spec => ({ key: spec.key, links: [] }),
    commit: links => {
      self.setLaneLinks(links)
    },
  })
}
