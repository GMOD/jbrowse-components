import type { LaneLinks } from './alignmentOps.ts'
import type { LaneGene } from './geneGlyph.ts'
import type { LodTier } from '@jbrowse/synteny-core'

export interface LaneRegion {
  assemblyName: string
  refName: string
  start: number
  end: number
}

/**
 * One lane's share of a dependent fetch. `lane` is the held map's key — the
 * lane's assembly, or the pair a link fetch joins — `key` is what the lane's
 * held result is stale against, and `assemblyName` is the genome the lane
 * draws, a pair's upper lane.
 */
export interface LaneFetchSpec {
  lane: string
  key: string
  assemblyName: string
}

export interface LaneGenesFetchSpec extends LaneFetchSpec {
  adapterConfig: Record<string, unknown>
  regions: LaneRegion[]
}

/**
 * One adjacent lane pair's fetch, `assemblyName` its upper lane. `regions` is
 * the window the pair is read inside: the upper lane's own, or with
 * `onAnchor` the anchor's, for a source that holds every lane inside its
 * anchor's window
 */
export interface LaneLinksFetchSpec extends LaneFetchSpec {
  lowerAssembly: string
  regions: LaneRegion[]
  onAnchor: boolean
  lodTier: LodTier
}

/** a lane's fetched result beside the region key it was fetched under */
export interface HeldLane {
  key: string
}

export interface HeldLaneGenes extends HeldLane {
  genes: LaneGene[]
}

export interface HeldLaneLinks extends HeldLane, LaneLinks {}

/**
 * What a dependent fetch holds: each lane's result under the key it asked
 * for, and the anchor the fetch last covered a mate lane under, which is
 * what readiness reads. Stamped from the anchor the specs were built under,
 * so a run landing after a re-anchor cannot mark the new anchor covered
 */
export interface LaneFetchState<Held extends HeldLane> {
  held?: Map<string, Held>
  landedFor?: string
}

/**
 * whether a spec list frames a mate lane. Not `length > 1`: the anchor has a
 * spec only where it has a gene track, so a window framing one mate on an
 * anchor without one is a single spec that is a mate's
 */
export function specsCoverMate(specs: LaneFetchSpec[], anchor: string) {
  return specs.some(spec => spec.assemblyName !== anchor)
}

/** the specs whose lane holds nothing fetched under their key */
export function staleLaneSpecs<Spec extends LaneFetchSpec>(
  specs: Spec[],
  state: LaneFetchState<HeldLane>,
) {
  return specs.filter(spec => state.held?.get(spec.lane)?.key !== spec.key)
}

/**
 * A commit: the held results the current specs still name, the fetched ones
 * over them, and the anchor stamped once the specs cover a mate lane. A lane
 * no spec names is dropped, so a payload the view has left stops counting
 */
export function landLaneFetch<Held extends HeldLane>(
  state: LaneFetchState<Held>,
  fetched: ReadonlyMap<string, Held>,
  specs: LaneFetchSpec[],
  anchor: string,
): LaneFetchState<Held> {
  const current = new Set(specs.map(spec => spec.lane))
  const held = new Map(
    [...(state.held ?? [])].filter(([lane]) => current.has(lane)),
  )
  for (const [lane, result] of fetched) {
    held.set(lane, result)
  }
  return {
    held,
    landedFor: specsCoverMate(specs, anchor) ? anchor : state.landedFor,
  }
}

/**
 * whether a dependent fetch is still part of loading: it has never landed
 * while asked for something, or it has not covered a mate lane under this
 * anchor while its specs name one or a description that could add one is out
 */
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

/**
 * The anchor a star source names in its `CoreGetInfo` header
 * (MultiPairwiseSyntenyAdapter's `anchorAssemblyName`); undefined for a header
 * that names none, which is every other adapter's.
 */
export function starAnchorOf(header: unknown) {
  return typeof header === 'object' &&
    header !== null &&
    'anchorAssemblyName' in header &&
    typeof header.anchorAssemblyName === 'string'
    ? header.anchorAssemblyName
    : undefined
}
