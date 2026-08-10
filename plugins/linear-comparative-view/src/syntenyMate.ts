import type { Feature } from '@jbrowse/core/util'

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

// `Feature.get` types non-standard keys as `unknown`, so reading `mate` needs a
// cast somewhere; this is the one place it happens. `undefined` is part of the
// return type rather than asserted away: a feature with no mate is what a
// non-synteny adapter under an LGVSyntenyDisplay produces, and every caller here
// runs inside an MST view or a jexl callback where a thrown TypeError takes out
// the whole context menu / tooltip rather than just this one field.
export function getMate(feature: Feature) {
  return feature.get('mate') as SyntenyMate | undefined
}

// The block's CIGAR, when the source carries one. `undefined` is the ordinary
// case, not an error: a PAF from minimap2 without `-c` has no `cg` tag, and
// neither do MashMap, MCScan or a PIF's coarse tier — the launch interpolates
// across such a block instead of walking it.
//
// Narrowed rather than cast, and here rather than in each of the three places
// that read it (the spec builder's walk, the launch dialog's "is there a CIGAR"
// wording, the mate-discovery worker's serialization): `Feature.get` types a
// non-standard key as `unknown`, so each copy was its own three-line
// `typeof val === 'string'` helper, and one of them read it untyped.
export function getCigar(feature: Feature) {
  const cigar = feature.get('CIGAR')
  return typeof cigar === 'string' ? cigar : undefined
}
