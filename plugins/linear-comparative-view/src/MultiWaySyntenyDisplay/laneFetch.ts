import type { LaneLinks } from './alignmentOps.ts'
import type { LaneGene } from './geneGlyph.ts'
import type { LodTier } from '@jbrowse/synteny-core'

export interface LaneRegion {
  assemblyName: string
  refName: string
  start: number
  end: number
}

/** `lane` keys the held map; `assemblyName` is the genome the lane draws. */
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
 * `assemblyName` is the upper lane; with `onAnchor`, `regions` are the
 * anchor's window.
 */
export interface LaneLinksFetchSpec extends LaneFetchSpec {
  lowerAssembly: string
  regions: LaneRegion[]
  onAnchor: boolean
  lodTier: LodTier
}

export interface HeldLane {
  key: string
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

/** Drops a lane no spec names. */
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

/** MultiPairwiseSyntenyAdapter's header `anchorAssemblyName` */
export function starAnchorOf(header: unknown) {
  return typeof header === 'object' &&
    header !== null &&
    'anchorAssemblyName' in header &&
    typeof header.anchorAssemblyName === 'string'
    ? header.anchorAssemblyName
    : undefined
}
