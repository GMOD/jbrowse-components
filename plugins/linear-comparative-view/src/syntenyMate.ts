import type { Feature } from '@jbrowse/core/util'
import type { SyntenyMate } from '@jbrowse/synteny-core'

// The alignment-string readers moved to synteny-core so the comparative
// adapters can clip a record worker-side with the same walk this plugin uses,
// and `getMate` followed them so the circular ribbons read a mate the same way.
export {
  getAlignmentOps,
  getCigar,
  getCoarseCigar,
  getMate,
  hasAlignmentString,
} from '@jbrowse/synteny-core'
export type { SyntenyMate } from '@jbrowse/synteny-core'

// A named record is a gene-shaped one (an MCScan/ortholog table row); a
// nameless one is an alignment (PAF, delta, chain). The distinction drives the
// contig votes' `voteEvidence` and the source-shape checks, and this is its
// one Feature-side spelling — the packed-lane side is synteny-core's
// `unnamedNameId`, since the packers turn the missing name into `UNNAMED`.
export function isNamedRecord(feature: Feature) {
  return feature.get('name') !== undefined
}

// One entry of a grouped feature's `mates`: a mate placement plus the
// orientation of ITS pair with the anchor, which a pairwise feature carries as
// its own top-level `strand` and so has nowhere else to go once several mates
// share one feature.
export type SyntenyGroupedMate = SyntenyMate & {
  orientation: number
}

// The `mates` of a feature fetched with `mateShape: 'grouped'`; undefined on
// the pairwise shape every other adapter and fetch produces.
export function getMates(feature: Feature) {
  const mates = feature.get('mates')
  return Array.isArray(mates) ? (mates as SyntenyGroupedMate[]) : undefined
}
