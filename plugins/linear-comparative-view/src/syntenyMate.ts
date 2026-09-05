import type { Feature } from '@jbrowse/core/util'

// The alignment-string readers moved to synteny-core so the comparative
// adapters can clip a record worker-side with the same walk this plugin uses.
export {
  getAlignmentOps,
  getCigar,
  getCoarseCigar,
  hasAlignmentString,
} from '@jbrowse/synteny-core'

// Synteny-feature `mate` shape: the other side of a PAF/delta/chain row. Shared
// by the display, the tooltip jexl function, the launch dialog and the synteny
// RPC — each of them used to keep its own copy of this interface plus its own
// cast, which is exactly how the shapes drift apart.
// A type alias rather than an interface on purpose: this is plain feature data
// that travels over the RPC, so it has to satisfy the open `[key: string]:
// unknown` shapes a serialized feature is declared with. An interface gets no
// implicit index signature and so does not, which leaves callers copying the
// object at runtime purely to widen it.
export type SyntenyMate = {
  start: number
  end: number
  refName: string
  assemblyName: string
  // only present when the source provides them (e.g. MCScan gene names)
  name?: string
  id?: string
}

// A named record is a gene-shaped one (an MCScan/ortholog table row); a
// nameless one is an alignment (PAF, delta, chain). The distinction drives the
// contig votes' `voteEvidence` and the source-shape checks, and this is its
// one Feature-side spelling — the packed-lane side is synteny-core's
// `unnamedNameId`, since the packers turn the missing name into `UNNAMED`.
export function isNamedRecord(feature: Feature) {
  return feature.get('name') !== undefined
}

// `Feature.get` types non-standard keys as `unknown`, so reading `mate` needs a
// cast somewhere; this is the one place it happens. `undefined` is part of the
// return type rather than asserted away: a feature with no mate is what a
// non-synteny adapter under an LGVSyntenyDisplay produces, and every caller here
// runs inside an MST view or a jexl callback where a thrown TypeError takes out
// the whole context menu / tooltip rather than just this one field.
export function getMate(feature: Feature) {
  return feature.get('mate') as SyntenyMate | undefined
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
