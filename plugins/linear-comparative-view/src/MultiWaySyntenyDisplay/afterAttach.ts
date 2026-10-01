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

/** make-pif --coarse's 10 kb bound, so the cut lands alike on either tier */
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
    // `prepare` captures `haplotypes`, so a landing carries the selection its
    // run asked for
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

/** One lane failing is a partial result: it commits `empty` under its key. */
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
 * `setError` stays a noop, so a lane failure never reaches the error slot the
 * ortholog fetch owns.
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

// captures the session, since `getSession` finds none once the view detaches
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
  installClearHoverOnSurfaceMove(self, {
    transform: () => self.ribbonGeometry.targets,
    clear: () => {
      self.clearHoveredFeature()
    },
    name: 'MultiWayClearHoverOnLaneRelayout',
  })
  installLaneFrameDecision(self)
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
      return { key: spec.key, genes: laneGeneFeatures(features) }
    },
    empty: spec => ({ key: spec.key, genes: [] }),
    commit: (genes, specs, anchor) => {
      self.setLaneGenes(genes, specs, anchor)
    },
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
