import { isRefNameAliasAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { adapterConfigCacheKey } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { dedupe, getSession, isAbortException } from '@jbrowse/core/util'
import { fanOutStatus } from '@jbrowse/core/util/fetchContext'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { installAnimationDeadline } from '@jbrowse/display-kit/displayAutoruns'
import { installGlobalFetchAutorun } from '@jbrowse/display-kit/installGlobalFetchAutorun'
import { addDisposer, getEnv, isAlive } from '@jbrowse/mobx-state-tree'
import {
  installClearHoverOnSurfaceMove,
  installLodTierInfoFetch,
} from '@jbrowse/synteny-core'
import { autorun, untracked } from 'mobx'

import { laneGeneFeatures } from './geneGlyph.ts'
import { decideLaneFrames, sameDecisions } from './laneDecision.ts'
import { fileRefNameOf, specsCoverMate, staleLaneSpecs } from './laneFetch.ts'
import { laneMotionEnd } from './laneMotion.ts'
import { mergeContiguousRegions } from './layoutMultiWay.ts'

import type {
  LaneFetchSpec,
  LaneGenesFetchSpec,
  LaneRegion,
} from './laneFetch.ts'
import type { FetchRegion } from './layoutMultiWay.ts'
import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Alias } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { GlobalFetchPhases } from '@jbrowse/display-kit/installGlobalFetchAutorun'
import type { LodTier } from '@jbrowse/synteny-core'

interface MultiWayFetchArgs {
  regions: FetchRegion[]
  lodTier: LodTier
  haplotypes: string[] | undefined
  anchor: string
  alignment: boolean
}

const DEPENDENT_FETCH_DELAY = 500

const DESCRIBE_DEADLINE_MS = 20_000

/**
 * The indel size at which a clipped record is cut into separate placements, so
 * an indel this size or larger does not vanish into a ribbon that says the two
 * sides run straight through. The coarse tier's default bound (`make-pif
 * --coarse`, 10 kb): that tier keeps every indel past half its bound as its own
 * op, so the cut lands the same on either tier.
 *
 * A gutter that is a direct pair now draws a record's own indels, so for those
 * the cut is what stops the wedge being drawn. It still holds for every other
 * consumer of a placement, which reads it as one linear mapping: composed
 * gutters interpolate within a run, and the lane weights and orientation vote
 * both count a run's anchor bp. Lifting it belongs with moving those three onto
 * the ops.
 */
export const SPLIT_AT_GAP_BP = 10_000

function fetchPhases(
  self: MultiWaySyntenyDisplayModel,
): GlobalFetchPhases<MultiWayFetchArgs, Feature[]> {
  return {
    prepare: () => {
      const regions = mergeContiguousRegions(
        self.lgv.staticBlocks.contentBlocks,
      )
      return regions.length
        ? {
            regions,
            lodTier: self.lodTier,
            haplotypes: self.fetchLaneSelection,
            anchor: self.anchorAssemblyName,
            alignment: self.adjacentLanesAlignDirectly,
          }
        : undefined
    },
    // no targetAssemblyName: a multi-genome adapter queried with no target
    // answers with every pair anchored on the queried assembly, which is
    // exactly the row set this display draws. `mateShape: 'grouped'` asks an
    // adapter that can to fold those pairs per anchor before they cross the
    // RPC; `groupFeatures` reads either shape, so one that cannot is
    // unaffected. The tier is the one the key was issued at, so an indexed
    // PIF at a whole-chromosome window serves its coarse rows. `clipToRegion`
    // cuts each alignment record to the window on both axes before it crosses
    // the RPC: a lane fitted to whole liftOver chains sat at 80x the window.
    // `splitAtGapBp` cuts it again at every large indel, one placement per run,
    // and `keepAlignment` keeps each run's own ops for the indels a gutter
    // draws, where every gutter is a direct pair: a star's lower gutters are
    // composed and have none, so its top gutter alone would draw them.
    // `haplotypes` is the lane selection where the source can cut on it, and it
    // narrows what is FETCHED rather than what is drawn: a pangenome graph
    // holds hundreds of haplotypes and the display usually shows eight, and
    // without this the window comes back whole and the stack throws away the
    // rest. Captured in `prepare` with the tier, so a landing is labelled with
    // the selection it was asked for and not a live re-read at commit
    run: async ({ regions, lodTier, haplotypes, alignment }, ctx) =>
      dedupe(
        await ctx.callRpc('CoreGetFeatures', {
          regions,
          adapterConfig: self.adapterConfig,
          opts: {
            mateShape: 'grouped',
            lodMode: lodTier,
            clipToRegion: true,
            splitAtGapBp: SPLIT_AT_GAP_BP,
            keepAlignment: alignment,
            ...(haplotypes === undefined ? {} : { haplotypes }),
          },
        }),
        r => r.id(),
      ),
    commit: (features, { anchor, haplotypes }) => {
      self.setFeatures(features, anchor, haplotypes)
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
 * A described lane's regions, named as its gene file names them and bound to
 * no assembly, since the session holds none to rename them through
 */
function describedLaneRegions(self: MultiWaySyntenyDisplayModel) {
  const { pluginManager } = getEnv<{ pluginManager: PluginManager }>(self)
  const loadAliasRows = async (snapshot: Record<string, unknown>) => {
    const type = pluginManager.getAdapterType(String(snapshot.type))
    const Adapter = await type.getAdapterClass()
    const adapter = new Adapter(
      type.configSchema.create(snapshot, { pluginManager }),
      undefined,
      pluginManager,
    )
    if (!isRefNameAliasAdapter(adapter)) {
      throw new Error(`${type.name} reads no refName aliases`)
    }
    return adapter.getRefNameAliases({})
  }
  const aliasLoads = new Map<string, Promise<Alias[]>>()
  const aliasRows = (snapshot: Record<string, unknown>) => {
    const key = adapterConfigCacheKey(snapshot)
    let load = aliasLoads.get(key)
    if (!load) {
      load = loadAliasRows(snapshot).catch((error: unknown) => {
        aliasLoads.delete(key)
        throw error
      })
      aliasLoads.set(key, load)
    }
    return load
  }
  return async (spec: LaneGenesFetchSpec, ctx: FetchContext) => {
    const unbound = spec.regions.map(region => ({
      ...region,
      assemblyName: '',
    }))
    if (!spec.refNameAliases) {
      return unbound
    }
    const [fileRefNames, aliases] = await Promise.all([
      ctx.callRpc('CoreGetRefNames', { adapterConfig: spec.adapterConfig }),
      aliasRows(spec.refNameAliases.adapter).catch((error: unknown) => {
        console.error(error)
        return []
      }),
    ])
    const fileRefName = fileRefNameOf(fileRefNames, aliases)
    return unbound.map(region => ({
      ...region,
      refName: fileRefName(region.refName),
    }))
  }
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
 * the answer lands. They share the rules below, each stated once here:
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
 *   with nothing stale re-reads every lane, as a Retry expects.
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
        const { anchorAbsX, fitGroups, rowAssemblies } = self
        // eslint-disable-next-line no-restricted-syntax -- SELF-WRITE for the decisions this body writes back; EFFECT INPUT for the offset, which every px below is relative to and which cancels out of the decision — it only stamps the space the frames are laid out against, and tracking it would re-decide on every pan
        const { origin, previous } = untracked(() => ({
          origin: view.offsetPx,
          previous: self.laneDecisions,
        }))
        const next = decideLaneFrames({
          groups: fitGroups,
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
          pinnedFlips: self.pinnedLaneFlips,
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

/**
 * Puts the drawn lanes the session lacks to `Core-describeAssemblies`, each
 * lane once, in one batch per change to the drawn set. A reload asks again
 * about the lanes that got no description
 */
function installLaneDescriptions(self: MultiWaySyntenyDisplayModel) {
  const { pluginManager } = getEnv<{ pluginManager: PluginManager }>(self)
  let reloads = self.reloadCounter
  addDisposer(
    self,
    autorun(
      () => {
        if (self.reloadCounter !== reloads) {
          reloads = self.reloadCounter
          self.forgetUndescribedLanes()
        }
        const names = self.lanesToDescribe
        if (names.length > 0) {
          self.beginDescribingLanes(names)
          const deadline = setTimeout(() => {
            if (isAlive(self)) {
              self.endDescribingLanes(names, {})
            }
          }, DESCRIBE_DEADLINE_MS)
          // eslint-disable-next-line no-restricted-syntax -- EFFECT INPUT: a plugin's reads before its first await belong to its answer, and the lanes to ask about are the trigger
          untracked(() =>
            pluginManager
              /** #extensionPoint Core-describeAssemblies | async | Describe, in one batch, assemblies the session does not hold, without adding them. Each callback adds to the descriptions the one before it returned */
              .evaluateAsyncExtensionPoint(
                'Core-describeAssemblies',
                {},
                { assemblyNames: names, session: getSession(self) },
              ),
          )
            .then(descriptions => {
              clearTimeout(deadline)
              if (isAlive(self)) {
                self.endDescribingLanes(names, descriptions)
              }
            })
            .catch((error: unknown) => {
              console.error(error)
            })
        }
      },
      { name: 'MultiWayDescribeLanes' },
    ),
  )
}

export function doAfterAttach(self: MultiWaySyntenyDisplayModel) {
  // The viewport clear the fetch foundation installs answers the axes the VIEW
  // moves on. The lanes also relayout with the view still — a reorder, a hidden
  // lane, a pinned contig, a dependent commit — which moves the ribbons out
  // from under a stationary pointer. The click is not the pointer's, and
  // re-resolves by key.
  installClearHoverOnSurfaceMove(self, {
    transform: () => self.ribbonGeometry.targets,
    clear: () => {
      self.clearHoveredFeature()
    },
    name: 'MultiWayClearHoverOnLaneRelayout',
  })
  installLaneFrameDecision(self)
  installAnimationDeadline(
    self,
    () => {
      const ends = [...self.laneTransitions.values()].map(laneMotionEnd)
      return ends.length > 0 ? Math.max(...ends) : undefined
    },
    () => {
      self.endAnimation()
    },
    'MultiWayLaneMotionDeadline',
  )
  installLaneDescriptions(self)
  // the header is also read for an untiered adapter that declares its lanes,
  // so the picker can offer the whole universe before any lane is placed
  installLodTierInfoFetch(self, {
    alsoWhen: () => self.adapterDeclaresLanes,
  })
  installGlobalFetchAutorun(self, {
    ...fetchPhases(self),
    delay: 1000,
    name: 'MultiWaySyntenyFetch',
  })

  // The second fetch: once the ortholog groups have settled into lane frames,
  // each lane's gene models out of that assembly's own gene track.
  const describedRegions = describedLaneRegions(self)
  installLaneFetch(self, {
    name: 'MultiWayLaneGenes',
    fetchSpecs: () => self.laneGenesFetchSpecs,
    held: () => self.laneGenes,
    fetchOne: async (spec, ctx) => {
      const features = await ctx.callRpc('CoreGetFeatures', {
        adapterConfig: spec.adapterConfig,
        regions: spec.held
          ? await laneRegions(getSession(self), spec.lane, spec.regions)
          : await describedRegions(spec, ctx),
      })
      return { key: spec.key, genes: laneGeneFeatures(features) }
    },
    empty: spec => ({ key: spec.key, genes: [] }),
    commit: (genes, specs) => {
      // the anchor's spec exists as soon as the view does, so a commit covers
      // a mate lane only once the ortholog fetch has framed one
      self.setLaneGenes(
        genes,
        specsCoverMate(specs, self.anchorAssemblyName)
          ? self.anchorAssemblyName
          : undefined,
      )
    },
  })

  // The third, for alignment-level sources: the direct records between each
  // ADJACENT mate-lane pair, out of the same track. The specs exist
  // only when the source names no genes, so a gene table never issues these,
  // and not for a star that announced its anchor, whose pairs `pairLinks`
  // composes instead, unless its adapter reads pairs inside the anchor's
  // window.
  installLaneFetch(self, {
    name: 'MultiWayLaneLinks',
    fetchSpecs: () => self.laneLinksFetchSpecs,
    held: () => self.laneLinks,
    fetchOne: async (spec, ctx) => {
      const links = await ctx.callRpc('CoreGetFeatures', {
        adapterConfig: self.adapterConfig,
        regions: spec.onAnchor
          ? spec.regions
          : await laneRegions(
              getSession(self),
              spec.upperAssembly,
              spec.regions,
            ),
        opts: {
          ...(spec.onAnchor ? { queryAssemblyName: spec.upperAssembly } : {}),
          targetAssemblyName: spec.lowerAssembly,
          lodMode: spec.lodTier,
          clipToRegion: true,
          splitAtGapBp: SPLIT_AT_GAP_BP,
          keepAlignment: true,
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
