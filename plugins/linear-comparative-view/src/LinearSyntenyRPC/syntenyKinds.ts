import {
  KIND_BASE_TILE,
  KIND_CIGAR_MIN,
  KIND_MARKER,
} from '../LinearSyntenyDisplay/shaders/syntenyTypes.generated.ts'

// Per-instance kind tag. Determines how the color for an instance is derived
// from the parent feature's strand/refName/featureIdx and the view's current `color`
// scheme. Emitted by the worker once during geometry build; colors are
// recomputed on the main thread whenever the color changes, so a color-scheme
// toggle never triggers an RPC refetch.
//
// The shaders only ever test BASE-vs-CIGAR (`isCigarKind`, i.e. kind >= the
// boundary) and marker-vs-not, so those two numbers are the shader's and are
// generated in (adr-051). The rest are numbered off the boundary here, which is
// what keeps the CIGAR kinds contiguous and above it by construction rather
// than by a comment asking for it.
export const KIND_BASE = 0
export { KIND_MARKER }
// One match segment of a tiled ribbon (transparent-indel mode). Colors as
// KIND_BASE — the `else` arm below is the one that paints both — and differs
// only in the renderers' sub-pixel width fade; see thinWidthFade.
export { KIND_BASE_TILE }
// Boundary only — the `isCigar = kind >= KIND_CIGAR_MATCH` threshold. Never
// emitted as an instance kind: buildSyntenyGeometry paints matches as
// KIND_BASE_TILE (transparent mode) or leaves them to the feature's base
// (colored mode).
export const KIND_CIGAR_MATCH = KIND_CIGAR_MIN
export const KIND_CIGAR_I = KIND_CIGAR_MIN + 1
export const KIND_CIGAR_D = KIND_CIGAR_MIN + 2
export const KIND_CIGAR_N = KIND_CIGAR_MIN + 3

// the kinds painted in their feature's own color, so one transparent there is
// a ribbon the color mode hides
export function paintsFeatureColor(kind: number) {
  return kind === KIND_BASE || kind === KIND_BASE_TILE
}
