import type { LaneGene } from './geneGlyph.ts'
import type { Feature } from '@jbrowse/core/util'
import type { LodTier } from '@jbrowse/synteny-core'

export interface LaneRegion {
  assemblyName: string
  refName: string
  start: number
  end: number
}

/**
 * One lane's share of a dependent fetch. `lane` is the held map's key — the
 * lane's assembly, or the pair a link fetch joins — and `key` is what the
 * lane's held result is stale against: the region it asked for.
 */
export interface LaneFetchSpec {
  lane: string
  key: string
}

export interface LaneGenesFetchSpec extends LaneFetchSpec {
  adapterConfig: Record<string, unknown>
  regions: LaneRegion[]
}

/**
 * whether a spec list frames a mate lane. Not `length > 1`: the anchor has a
 * spec only where it has a gene track, so a window framing one mate on an
 * anchor without one is a single spec that is a mate's
 */
export function specsCoverMate(specs: LaneFetchSpec[], anchor: string) {
  return specs.some(spec => spec.lane !== anchor)
}

/**
 * One adjacent lane pair's fetch. `regions` is the window the pair is read
 * inside: the upper lane's own, or with `onAnchor` the anchor's, for a source
 * that holds every lane inside its anchor's window
 */
export interface LaneLinksFetchSpec extends LaneFetchSpec {
  upperAssembly: string
  lowerAssembly: string
  regions: LaneRegion[]
  onAnchor: boolean
  lodTier: LodTier
}

/** a lane's fetched result beside the region key it was fetched under */
export interface HeldLaneGenes {
  key: string
  genes: LaneGene[]
}

export interface HeldLaneLinks {
  key: string
  links: Feature[]
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

/** the specs whose lane holds nothing fetched under their key */
export function staleLaneSpecs<Spec extends LaneFetchSpec>(
  specs: Spec[],
  held: ReadonlyMap<string, { key: string }> | undefined,
) {
  return specs.filter(spec => held?.get(spec.lane)?.key !== spec.key)
}
