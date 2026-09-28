import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import {
  dedupe,
  getEnv,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { fanOutStatus } from '@jbrowse/core/util/fetchContext'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { installAnimationDeadline } from '@jbrowse/display-kit/displayAutoruns'
import { installGlobalFetchAutorun } from '@jbrowse/display-kit/installGlobalFetchAutorun'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import {
  installClearHoverOnSurfaceMove,
  installLodTierInfoFetch,
} from '@jbrowse/synteny-core'
import { autorun, untracked } from 'mobx'

import { laneGeneFeatures } from './geneGlyph.ts'
import { sameDecisions } from './laneDecision.ts'
import { staleLaneSpecs } from './laneFetch.ts'
import { laneMotionEnd } from './laneMotion.ts'
import { mergeContiguousRegions } from './layoutMultiWay.ts'

import type { MultiWayFeatures } from './MultiWayGetFeatures.ts'
import type {
  HeldLane,
  LaneFetchSpec,
  LaneFetchState,
  LaneRegion,
} from './laneFetch.ts'
import type { HeldLaneLayer } from './laneLayers.ts'
import type { FetchRegion } from './layoutMultiWay.ts'
import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { GlobalFetchPhases } from '@jbrowse/display-kit/installGlobalFetchAutorun'
import type { LodTier } from '@jbrowse/synteny-core'

interface MultiWayFetchArgs {
  regions: FetchRegion[]
  lodTier: LodTier
  haplotypes: string[] | undefined
  anchor: string
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
 * A gutter that is a direct pair leaves a record's own indels open between its
 * tiles, so for those the cut changes nothing a reader sees. Three consumers
 * still read a
 * placement as one linear mapping and keep it earning its place: composed
 * gutters interpolate within a run, `rowAssembliesOf` orders lanes by a run's
 * anchor bp, and the orientation vote weighs the same bp where the source is an
 * alignment. Lifting it belongs with moving those three onto the ops.
 */
export const SPLIT_AT_GAP_BP = 10_000

function fetchPhases(
  self: MultiWaySyntenyDisplayModel,
): GlobalFetchPhases<MultiWayFetchArgs, MultiWayFeatures> {
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
    // and `MultiWayGetFeatures` hands each run's own ops back beside it, which
    // every gutter draws:
    // the anchor's from the record itself, a lower one's composed from the two
    // records it sits between (`composeAlignmentOps`).
    // `haplotypes` is the lane selection where the source can cut on it, and it
    // narrows what is FETCHED rather than what is drawn: a pangenome graph
    // holds hundreds of haplotypes and the display usually shows eight, and
    // without this the window comes back whole and the stack throws away the
    // rest. Captured in `prepare` with the tier, so a landing is labelled with
    // the selection it was asked for and not a live re-read at commit
    run: async ({ regions, lodTier, haplotypes }, ctx) => {
      const { features, ops } = await ctx.callRpc('MultiWayGetFeatures', {
        regions,
        adapterConfig: self.adapterConfig,
        ...(haplotypes === undefined ? {} : { haplotypes }),
        opts: {
          mateShape: 'grouped',
          lodMode: lodTier,
          clipToRegion: true,
          splitAtGapBp: SPLIT_AT_GAP_BP,
        },
      })
      return { features: dedupe(features, r => r.id()), ops }
    },
    commit: ({ features, ops }, { anchor, haplotypes }) => {
      self.setFeatures(features, anchor, haplotypes, ops)
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
function installLaneFetch<Spec extends LaneFetchSpec, Result extends HeldLane>(
  self: MultiWaySyntenyDisplayModel,
  {
    name,
    fetchSpecs,
    state,
    fetchOne,
    empty,
    commit,
  }: {
    name: string
    fetchSpecs: () => Spec[]
    state: () => LaneFetchState<HeldLane>
    fetchOne: (spec: Spec, ctx: FetchContext) => Promise<Result>
    empty: (spec: Spec) => Result
    commit: (byLane: Map<string, Result>, specs: Spec[], anchor: string) => void
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
        ? {
            specs,
            stale: staleLaneSpecs(specs, state()),
            anchor: self.anchorAssemblyName,
          }
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
    commit: (byLane, { specs, anchor }) => {
      commit(byLane, specs, anchor)
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
        // eslint-disable-next-line no-restricted-syntax -- SELF-WRITE for the decisions this body writes back; EFFECT INPUT for the offset, which every px below is relative to and which cancels out of the decision — it only stamps the space the frames are laid out against, and tracking it would re-decide on every pan
        const { origin, previous } = untracked(() => ({
          origin: view.offsetPx,
          previous: self.laneDecisions,
        }))
        const next = self.laneDecisionsAt(
          origin,
          previous,
          self.frozenDecisions,
        )
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
 * Holds each described genome as a temporary assembly, so its lane's fetches
 * reach its sequence and aliases through renaming as a held lane's do, and
 * puts one back that another display released while this one still draws it.
 * Gives them back when the display goes, through the session captured here:
 * a display is destroyed after its view is detached, when `getSession` no
 * longer reaches one
 */
function installLaneAssemblies(self: MultiWaySyntenyDisplayModel) {
  const session = getSession(self)
  const held = new Set<string>()
  addDisposer(
    self,
    autorun(
      () => {
        for (const [lane, assembly] of self.laneAssemblyConfs) {
          const name = String(assembly.name)
          if (!self.holdsAssembly(lane) && !self.holdsAssembly(name)) {
            session.addTemporaryAssembly?.(assembly)
          }
          held.add(name)
        }
      },
      { name: 'MultiWayLaneAssemblies' },
    ),
  )
  addDisposer(self, () => {
    if (isAlive(session)) {
      for (const name of held) {
        session.removeTemporaryAssembly?.(name)
      }
    }
  })
}

/**
 * Puts the drawn lanes the session lacks to `Core-describeAssemblies`, each
 * lane once, in one batch per change to the drawn set. A reload asks again
 * about the lanes that got no description
 */
function installLaneDescriptions(self: MultiWaySyntenyDisplayModel) {
  const { pluginManager } = getEnv(self)
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
              /** #extensionPoint Core-describeAssemblies | async | Describe, in one batch, assemblies the session does not hold: each one's assembly config and gene adapter, read without connecting anything. Each callback adds to the descriptions the one before it returned */
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
  installLaneAssemblies(self)
  // the header is also read for an untiered adapter that declares its lanes,
  // so the picker can offer the whole universe before any lane is placed
  installLodTierInfoFetch(self, {
    alsoWhen: () => self.adapterDeclaresLanes,
    lanes: () => self.fetchLaneSelection,
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
    state: () => self.laneGenes,
    fetchOne: async (spec, ctx) => {
      const features = await ctx.callRpc('CoreGetFeatures', {
        adapterConfig: spec.adapterConfig,
        regions: await laneRegions(getSession(self), spec.lane, spec.regions),
      })
      return { key: spec.key, genes: laneGeneFeatures(features) }
    },
    empty: spec => ({ key: spec.key, genes: [] }),
    commit: (genes, specs, anchor) => {
      self.setLaneGenes(genes, specs, anchor)
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
    state: () => self.laneLinks,
    fetchOne: async (spec, ctx) => {
      const haplotypes = self.fetchLaneSelection
      const { features: links, ops } = await ctx.callRpc(
        'MultiWayGetFeatures',
        {
          adapterConfig: self.adapterConfig,
          ...(haplotypes === undefined ? {} : { haplotypes }),
          regions: spec.onAnchor
            ? spec.regions
            : await laneRegions(
                getSession(self),
                spec.assemblyName,
                spec.regions,
              ),
          opts: {
            ...(spec.onAnchor ? { queryAssemblyName: spec.assemblyName } : {}),
            targetAssemblyName: spec.lowerAssembly,
            lodMode: spec.lodTier,
            clipToRegion: true,
            splitAtGapBp: SPLIT_AT_GAP_BP,
          },
        },
      )
      return { key: spec.key, links, ops }
    },
    empty: spec => ({ key: spec.key, links: [], ops: new Map() }),
    commit: (links, specs, anchor) => {
      self.setLaneLinks(links, specs, anchor)
    },
  })

  installLaneFetch(self, {
    name: 'MultiWayLaneLayers',
    fetchSpecs: () => self.laneLayersFetchSpecs,
    state: () => self.laneLayerData,
    fetchOne: async (spec, ctx): Promise<HeldLaneLayer> => {
      const [region] = await laneRegions(getSession(self), spec.assemblyName, [
        spec.region,
      ])
      const result = await ctx.callRpc('CoreGetEncodedLayers', {
        adapterConfig: spec.adapterConfig,
        region: region!,
        layers: spec.requests,
        bpPerPx: spec.bpPerPx,
      })
      return {
        key: spec.key,
        assemblyName: spec.assemblyName,
        layer: spec.layer,
        region: spec.region,
        channels: isRegionRefused(result) ? [] : result.layers,
      }
    },
    empty: spec => ({
      key: spec.key,
      assemblyName: spec.assemblyName,
      layer: spec.layer,
      region: spec.region,
      channels: [],
    }),
    commit: (layers, specs, anchor) => {
      self.setLaneLayerData(layers, specs, anchor)
    },
  })
}
