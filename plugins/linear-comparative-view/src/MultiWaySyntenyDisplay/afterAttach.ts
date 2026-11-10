import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { dedupe, getEnv, getSession } from '@jbrowse/core/util'
import { fanOutStatus } from '@jbrowse/core/util/fetchContext'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { installAnimationDeadline } from '@jbrowse/display-kit/displayAutoruns'
import { installGlobalFetchAutorun } from '@jbrowse/display-kit/installGlobalFetchAutorun'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import {
  getCanonicalRefNameFn,
  installClearHoverOnSurfaceMove,
  installLodTierInfoFetch,
} from '@jbrowse/synteny-core'
import { autorun, reaction, untracked } from 'mobx'

import { getMate } from '../syntenyMate.ts'
import { lanePairKey } from './alignmentOps.ts'
import { laneGeneFeatures } from './geneGlyph.ts'
import { laneFetchAsked, staleLaneSpecs } from './laneFetch.ts'
import { holdLaneAssembly, releaseLaneAssemblies } from './laneHolders.ts'
import { laneMotionEnd } from './laneMotion.ts'

import type { MultiWayFeatures } from './MultiWayGetFeatures.ts'
import type {
  HeldLane,
  HeldLaneLinks,
  LaneFetchSpec,
  LaneFetchState,
  LaneLinksFetchSpec,
} from './laneFetch.ts'
import type { HeldLaneLayer } from './laneLayers.ts'
import type { FetchRegion } from './layoutMultiWay.ts'
import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
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

function fetchPhases(
  self: MultiWaySyntenyDisplayModel,
): GlobalFetchPhases<MultiWayFetchArgs, MultiWayFeatures> {
  return {
    prepare: () => {
      const regions = self.anchorFetchRegions
      return regions.length
        ? {
            regions,
            lodTier: self.lodTier,
            haplotypes: self.fetchLaneSelection,
            anchor: self.anchorAssemblyName,
          }
        : undefined
    },
    // `prepare` captures `haplotypes`, so a landing carries the selection its
    // run asked for
    run: async ({ regions, lodTier, haplotypes }, ctx) => {
      const { features, ops, deletions } = await ctx.callRpc(
        'MultiWayGetFeatures',
        {
          regions,
          adapterConfig: self.adapterConfig,
          ...(haplotypes === undefined ? {} : { haplotypes }),
          opts: {
            mateShape: 'grouped',
            lodTier,
          },
        },
      )
      return { features: dedupe(features, r => r.id()), ops, deletions }
    },
    commit: ({ features, ops, deletions }, { regions, anchor, haplotypes }) => {
      self.setFeatures(features, anchor, haplotypes, ops, deletions)
      self.holdLaneOrder(regions)
    },
  }
}

async function laneRegions(
  session: AbstractSessionModel,
  assemblyName: string,
  regions: FetchRegion[],
) {
  const canonical = await getCanonicalRefNameFn({
    assemblyManager: session.assemblyManager,
    assemblyName,
  })
  return regions.map(r => ({ ...r, refName: canonical(r.refName) }))
}

/**
 * A lane that fails commits `empty` and its error under its key, an abort
 * included: every lane shares the run's signal, which aborts only as the run
 * stops being current, and a stale run commits nothing.
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
  const failed = (spec: Spec, error: unknown) => {
    if (!ctx.isStale()) {
      console.error(`${label}: one lane failed`, error)
    }
    return { ...empty(spec), error }
  }
  return new Map(
    specs.map((spec, i) => {
      const result = settled[i]!
      return [
        spec.lane,
        result.status === 'fulfilled'
          ? result.value
          : failed(spec, result.reason),
      ] as const
    }),
  )
}

/**
 * Every pair in one call, which the adapter answers from a single cut of the
 * anchor's window; a record goes to the pair its lane and its mate's lane name.
 * A failed call fails every pair in it.
 */
async function fetchLanePairBatch(
  self: MultiWaySyntenyDisplayModel,
  [first, ...rest]: [LaneLinksFetchSpec, ...LaneLinksFetchSpec[]],
  ctx: FetchContext,
) {
  const specs = [first, ...rest]
  const held = new Map(
    specs.map(spec => [
      spec.lane,
      {
        key: spec.key,
        links: [] as Feature[],
        ops: new Map<string, Uint32Array>(),
      },
    ]),
  )
  try {
    const { features, ops } = await ctx.callRpc('MultiWayGetFeatures', {
      adapterConfig: self.adapterConfig,
      regions: first.regions,
      opts: {
        lanePairs: specs.map(spec => ({
          queryAssemblyName: spec.assemblyName,
          targetAssemblyName: spec.lowerAssembly,
        })),
        lodTier: first.lodTier,
      },
    })
    for (const feature of features) {
      const mate = getMate(feature)
      const pair =
        mate &&
        held.get(
          lanePairKey(feature.get('assemblyName') as string, mate.assemblyName),
        )
      if (pair) {
        pair.links.push(feature)
        const op = ops.get(feature.id())
        if (op) {
          pair.ops.set(feature.id(), op)
        }
      }
    }
    return new Map<string, HeldLaneLinks>(held)
  } catch (error) {
    if (!ctx.isStale()) {
      console.error('MultiWayLaneLinks: the pair batch failed', error)
    }
    return new Map<string, HeldLaneLinks>(
      [...held].map(([lane, result]) => [lane, { ...result, error }] as const),
    )
  }
}

/**
 * `setError` stays a noop: a lane failure shows on its own lane, not in the
 * error slot the ortholog fetch owns.
 */
function installLaneFetch<Spec extends LaneFetchSpec, Result extends HeldLane>(
  self: MultiWaySyntenyDisplayModel,
  {
    name,
    fetchSpecs,
    state,
    fetchOne,
    fetchMany,
    empty,
    commit,
  }: {
    name: string
    fetchSpecs: () => Spec[]
    state: () => LaneFetchState<HeldLane>
    fetchOne: (spec: Spec, ctx: FetchContext) => Promise<Result>
    /** answers every spec in one go, or undefined to fetch each */
    fetchMany?: (
      specs: Spec[],
      ctx: FetchContext,
    ) => Promise<Map<string, Result>> | undefined
    empty: (spec: Spec) => Result
    commit: (byLane: Map<string, Result>, specs: Spec[], anchor: string) => void
  },
) {
  let inFlight: string | undefined
  installFetch(self, {
    name,
    delay: DEPENDENT_FETCH_DELAY,
    report: { statusWindow: self.statusWindow },
    gate: () => !self.isMinimized,
    prepare: () => {
      const specs = fetchSpecs()
      const current = state()
      const stale = staleLaneSpecs(specs, current)
      const anchor = self.anchorAssemblyName
      return specs.length > 0 || current.held.size > 0
        ? { specs, stale, anchor, asked: laneFetchAsked(specs, stale, anchor) }
        : undefined
    },
    heldAnswers: ({ specs, stale, asked }) =>
      asked === inFlight || (specs.length > 0 && stale.length === 0),
    run: ({ specs, stale, asked }, ctx) => {
      inFlight = asked
      const wanted = stale.length > 0 ? stale : specs
      return (
        fetchMany?.(wanted, ctx) ??
        fetchEachLane(name, wanted, ctx, fetchOne, empty)
      )
    },
    commit: (byLane, { specs, anchor }) => {
      commit(byLane, specs, anchor)
    },
    onEnd: current => {
      if (current) {
        inFlight = undefined
      }
    },
    setError: () => {},
  })
}

// Decides at the settled view, which each frame draws at the live zoom
// (`frameFromDecision`), so a zoom animation re-decides nothing.
function installLaneFrameDecision(self: MultiWaySyntenyDisplayModel) {
  addDisposer(
    self,
    autorun(
      () => {
        const view = self.lgv
        if (!view.initialized) {
          return
        }
        // eslint-disable-next-line no-restricted-syntax -- SELF-WRITE: setLaneFrames writes it, and it is the hysteresis's incumbent
        const previous = untracked(() => self.laneDecisions)
        self.setLaneFrames(
          view.coarseOffsetPx,
          self.laneDecisionsAt({
            originPx: view.coarseOffsetPx,
            bpPerPx: view.coarseBpPerPx,
            previous,
            frozen: self.frozenDecisions,
          }),
        )
      },
      { name: 'MultiWayLaneFrames' },
    ),
  )
}

// The stack clips to a screen either side of its origin (`stackReach`), so a
// view more than a screen from it would draw blank.
function installOriginRestamp(self: MultiWaySyntenyDisplayModel) {
  addDisposer(
    self,
    reaction(
      () =>
        self.lgv.initialized &&
        Math.abs(self.dragOffsetPx) > self.canvasWidthPx,
      stale => {
        if (stale) {
          self.restampOrigin()
        }
      },
      { fireImmediately: true, name: 'MultiWayOriginRestamp' },
    ),
  )
}

function installFreezeExpiry(self: MultiWaySyntenyDisplayModel) {
  addDisposer(
    self,
    autorun(
      () => {
        if (self.lgv.initialized && self.frozenLanes && !self.lanesFrozen) {
          self.setLanesFrozen(false)
        }
      },
      { name: 'MultiWayFreezeExpiry' },
    ),
  )
}

// A restored session's temporary assembly has no adder, so the display holds
// whatever it draws. Captures the session, since `getSession` finds none once
// the view detaches.
function installLaneAssemblies(self: MultiWaySyntenyDisplayModel) {
  const session = getSession(self)
  addDisposer(
    self,
    autorun(
      () => {
        for (const [lane, assembly] of self.laneAssemblyConfs) {
          const name = String(assembly.name)
          if (!self.holdsAssembly(lane) && !self.holdsAssembly(name)) {
            session.addTemporaryAssembly?.(assembly)
          }
          holdLaneAssembly(self, session, name)
        }
      },
      { name: 'MultiWayLaneAssemblies' },
    ),
  )
  addDisposer(self, () => {
    releaseLaneAssemblies(self)
  })
}

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
              /** #extensionPoint Core-describeAssemblies | async | Describe, in one batch, assemblies absent from the session: each one's assembly config and gene adapter, read without connecting anything. Each callback adds to the descriptions the one before it returned */
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
              clearTimeout(deadline)
              if (isAlive(self)) {
                self.endDescribingLanes(names, {})
              }
            })
        }
      },
      { name: 'MultiWayDescribeLanes' },
    ),
  )
}

export function doAfterAttach(self: MultiWaySyntenyDisplayModel) {
  installClearHoverOnSurfaceMove(self, {
    transform: () => self.ribbonGeometry.targets,
    clear: () => {
      self.clearHoveredFeature()
    },
    name: 'MultiWayClearHoverOnLaneRelayout',
  })
  installLaneFrameDecision(self)
  installOriginRestamp(self)
  installFreezeExpiry(self)
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
  installLodTierInfoFetch(self, {
    alsoWhen: () => self.adapterDeclaresLanes,
    lanes: () => self.fetchLaneSelection,
  })
  installGlobalFetchAutorun(self, {
    ...fetchPhases(self),
    delay: 1000,
    name: 'MultiWaySyntenyFetch',
  })

  installLaneFetch(self, {
    name: 'MultiWayLaneGenes',
    fetchSpecs: () => self.laneGenesFetchSpecs,
    state: () => self.laneGenes,
    fetchOne: async (spec, ctx) => {
      const features = await ctx.callRpc('CoreGetFeatures', {
        adapterConfig: spec.adapterConfig,
        regions: await laneRegions(getSession(self), spec.lane, spec.regions),
      })
      const admitted = new SerializableFilterChain({
        filters: spec.filter,
        jexl: getEnv(self).pluginManager.jexl,
      })
      return {
        key: spec.key,
        genes: laneGeneFeatures(
          features.filter(f => admitted.passes(f)),
          spec.isoforms,
        ),
      }
    },
    empty: spec => ({ key: spec.key, genes: [] }),
    commit: self.setLaneGenes,
  })

  installLaneFetch(self, {
    name: 'MultiWayLaneLinks',
    fetchSpecs: () => self.laneLinksFetchSpecs,
    state: () => self.laneLinks,
    fetchOne: async (spec, ctx) => {
      const { features: links, ops } = await ctx.callRpc(
        'MultiWayGetFeatures',
        {
          adapterConfig: self.adapterConfig,
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
            lodTier: spec.lodTier,
          },
        },
      )
      return { key: spec.key, links, ops }
    },
    fetchMany: ([first, ...rest], ctx) =>
      first && self.adapterBatchesLanePairs && self.adapterPairsOnAnchor
        ? fetchLanePairBatch(self, [first, ...rest], ctx)
        : undefined,
    empty: spec => ({ key: spec.key, links: [], ops: new Map() }),
    commit: self.setLaneLinks,
  })

  installLaneFetch(self, {
    name: 'MultiWayLaneGroups',
    fetchSpecs: () => self.laneGroupsFetchSpecs,
    state: () => self.laneGroups,
    fetchOne: async (spec, ctx) => {
      const { features } = await ctx.callRpc('MultiWayGetFeatures', {
        adapterConfig: self.adapterConfig,
        regions: await laneRegions(getSession(self), spec.lane, spec.regions),
        opts: { mateShape: 'grouped', lodTier: spec.lodTier },
      })
      return { key: spec.key, features }
    },
    empty: spec => ({ key: spec.key, features: [] }),
    commit: self.setLaneGroups,
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
    commit: self.setLaneLayerData,
  })
}
