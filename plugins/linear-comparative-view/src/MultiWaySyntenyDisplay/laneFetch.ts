import { lanePairKey } from './alignmentOps.ts'
import { laneGeneFilter, laneIsoformSettings } from './geneGlyph.ts'

import type { LaneLinks } from './alignmentOps.ts'
import type { LaneGene } from './geneGlyph.ts'
import type { FetchRegion } from './layoutMultiWay.ts'
import type { TrackConfigEntry } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { IsoformSettings } from '@jbrowse/plugin-features'
import type { LodTier } from '@jbrowse/synteny-core'

/** `templateRegions` is what a template layer reads, none past its cap */
export interface LaneWindow {
  regions: FetchRegion[]
  templateRegions: FetchRegion[] | undefined
  bpPerPx: number
}

export interface LanePair {
  upper: string
  lower: string
  key: string
}

/** each adjacent pair of mate lanes, top down */
export function lanePairsOf(rows: readonly string[]): LanePair[] {
  return rows.slice(1).map((lower, i) => {
    const upper = rows[i]!
    return { upper, lower, key: lanePairKey(upper, lower) }
  })
}

/** `lane` keys the held map; `assemblyName` is the genome the lane draws. */
export interface LaneFetchSpec {
  lane: string
  key: string
  assemblyName: string
}

export interface LaneGenesFetchSpec extends LaneFetchSpec {
  adapterConfig: Record<string, unknown>
  regions: FetchRegion[]
  isoforms: IsoformSettings
  filter: string[]
}

/**
 * `assemblyName` is the upper lane; with `onAnchor`, `regions` are the
 * anchor's window.
 */
export interface LaneLinksFetchSpec extends LaneFetchSpec {
  lowerAssembly: string
  regions: FetchRegion[]
  onAnchor: boolean
  lodTier: LodTier
}

export interface LaneGroupsFetchSpec extends LaneFetchSpec {
  regions: FetchRegion[]
  lodTier: LodTier
}

/** a failed fetch holds its empty result and the error, so it is not refetched */
export interface HeldLane {
  key: string
  error?: unknown
}

export interface HeldLaneGroups extends HeldLane {
  features: Feature[]
}

export interface HeldLaneGenes extends HeldLane {
  genes: LaneGene[]
}

export interface HeldLaneLinks extends HeldLane, LaneLinks {}

/**
 * `landedFor` stamps the specs' own anchor, so a run landing after a
 * re-anchor cannot mark the new anchor covered.
 */
export interface LaneFetchState<Held extends HeldLane> {
  held?: Map<string, Held>
  landedFor?: string
}

/** Not `length > 1`: an anchor without a gene track has no spec. */
export function specsCoverMate(specs: LaneFetchSpec[], anchor: string) {
  return specs.some(spec => spec.assemblyName !== anchor)
}

export function staleLaneSpecs<Spec extends LaneFetchSpec>(
  specs: Spec[],
  state: LaneFetchState<HeldLane>,
) {
  return specs.filter(spec => state.held?.get(spec.lane)?.key !== spec.key)
}

/**
 * Drops a lane no spec names; with `keepCurrentKeys`, one held under a key a
 * spec still carries stays, as a scrolled-out pair does
 */
export function landLaneFetch<Held extends HeldLane>(
  state: LaneFetchState<Held>,
  fetched: ReadonlyMap<string, Held>,
  specs: LaneFetchSpec[],
  anchor: string,
  keepCurrentKeys = false,
): LaneFetchState<Held> {
  const current = new Set(specs.map(spec => spec.lane))
  const keys = new Set(keepCurrentKeys ? specs.map(spec => spec.key) : [])
  const held = new Map(
    [...(state.held ?? [])].filter(
      ([lane, result]) => current.has(lane) || keys.has(result.key),
    ),
  )
  for (const [lane, result] of fetched) {
    held.set(lane, result)
  }
  return {
    held,
    landedFor: specsCoverMate(specs, anchor) ? anchor : state.landedFor,
  }
}

/** each current spec whose held answer is a failure, with that answer */
export function failedLanesOf<Held extends HeldLane>(
  state: LaneFetchState<Held>,
  specs: readonly LaneFetchSpec[],
) {
  return specs.flatMap(spec => {
    const held = state.held?.get(spec.lane)
    return held?.key === spec.key && held.error !== undefined
      ? [[spec, held] as const]
      : []
  })
}

/** drops each failed lane, so the next run asks for it again */
export function forgetFailedLanes<Held extends HeldLane>(
  state: LaneFetchState<Held>,
): LaneFetchState<Held> {
  return state.held
    ? {
        ...state,
        held: new Map(
          [...state.held].filter(([, held]) => held.error === undefined),
        ),
      }
    : state
}

export function laneFetchAwaits(
  state: LaneFetchState<HeldLane>,
  specs: LaneFetchSpec[],
  anchor: string,
  describing: boolean,
) {
  return (
    (state.held === undefined && specs.length > 0) ||
    (state.landedFor !== anchor &&
      (describing || specsCoverMate(specs, anchor)))
  )
}

export function regionKey(r: FetchRegion) {
  return `${r.refName}:${r.start}-${r.end}`
}

export interface LaneGenesSpecInputs {
  windows: ReadonlyMap<string, LaneWindow>
  adapters: ReadonlyMap<string, Record<string, unknown>>
  tracks: ReadonlyMap<string, TrackConfigEntry>
}

export function laneGenesFetchSpecsOf({
  windows,
  adapters,
  tracks,
}: LaneGenesSpecInputs) {
  const specs: LaneGenesFetchSpec[] = []
  for (const [assemblyName, { regions }] of windows) {
    const adapter = adapters.get(assemblyName)
    if (adapter) {
      const entry = tracks.get(assemblyName)
      const isoforms = laneIsoformSettings(entry)
      const filter = laneGeneFilter(entry)
      const source = entry
        ? `${entry.trackId}|${JSON.stringify({ isoforms, filter })}`
        : `adapter:${JSON.stringify(adapter)}`
      specs.push({
        lane: assemblyName,
        key: `${source}@${regions.map(regionKey).join(',')}`,
        assemblyName,
        adapterConfig: adapter,
        regions,
        isoforms,
        filter,
      })
    }
  }
  return specs
}

export function laneGroupsFetchSpecsOf(
  lanes: readonly string[],
  windows: ReadonlyMap<string, Pick<LaneWindow, 'regions'>>,
  lodTier: LodTier,
) {
  return lanes.flatMap(lane => {
    const regions = windows.get(lane)?.regions
    return regions
      ? [
          {
            lane,
            key: `${regions.map(regionKey).join(',')}|${lodTier}`,
            assemblyName: lane,
            regions,
            lodTier,
          },
        ]
      : []
  })
}

export interface LaneLinksSpecInputs {
  pairs: readonly LanePair[]
  windows: ReadonlyMap<string, Pick<LaneWindow, 'regions'>>
  rowFrames: ReadonlyMap<string, unknown>
  anchor: string
  onAnchor: boolean
  lodTier: LodTier
  nearViewport: (upperRow: number, lowerRow: number) => boolean
}

/**
 * One spec per adjacent mate-lane pair whose gutter is on screen or within a
 * screen of it.
 */
export function laneLinksFetchSpecsOf({
  pairs,
  windows,
  rowFrames,
  anchor,
  onAnchor,
  lodTier,
  nearViewport,
}: LaneLinksSpecInputs) {
  const pairRegions = (upper: string, lower: string) => {
    if (onAnchor) {
      return rowFrames.get(upper) && rowFrames.get(lower)
        ? (windows.get(anchor)?.regions ?? [])
        : []
    }
    const upperWindow = windows.get(upper)
    return upperWindow && windows.get(lower) ? upperWindow.regions : []
  }
  const specs: LaneLinksFetchSpec[] = []
  for (const [i, { upper, lower, key }] of pairs.entries()) {
    const regions = nearViewport(i + 1, i + 2) ? pairRegions(upper, lower) : []
    if (regions.length > 0) {
      specs.push({
        lane: key,
        key: `${regions.map(regionKey).join(',')}|${lodTier}`,
        assemblyName: upper,
        lowerAssembly: lower,
        regions,
        onAnchor,
        lodTier,
      })
    }
  }
  return specs
}

/**
 * Each adjacent pair, by index, that `laneLinksFetchSpecsOf` never asks for
 * because a placed lane's genome is not in the session, with those genomes
 */
export function unheldLanePairsOf({
  pairs,
  rowFrames,
  onAnchor,
  isMissing,
}: {
  pairs: readonly LanePair[]
  rowFrames: ReadonlyMap<string, unknown>
  onAnchor: boolean
  isMissing: (assemblyName: string) => boolean
}) {
  return onAnchor
    ? []
    : pairs.flatMap(({ upper, lower }, index) => {
        const missing = [upper, lower].filter(isMissing)
        return rowFrames.get(upper) && rowFrames.get(lower) && missing.length
          ? [{ index, missing }]
          : []
      })
}

/** a star source's header `anchorAssemblyName` */
export function starAnchorOf(header: unknown) {
  return typeof header === 'object' &&
    header !== null &&
    'anchorAssemblyName' in header &&
    typeof header.anchorAssemblyName === 'string'
    ? header.anchorAssemblyName
    : undefined
}
