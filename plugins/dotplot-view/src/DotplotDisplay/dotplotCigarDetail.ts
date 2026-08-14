import {
  CIGAR_D,
  CIGAR_I,
  CIGAR_INDEL_MASK,
  CIGAR_N,
} from '@jbrowse/cigar-utils'

// The three ops `CIGAR_INDEL_MASK` admits, under the letters a user reads them
// by. Keyed off the constants rather than a string index, so it cannot drift
// from the mask beside it.
const CIGAR_OP_LETTER: Record<number, string> = {
  [CIGAR_I]: 'I',
  [CIGAR_D]: 'D',
  [CIGAR_N]: 'N',
}

// Below this on-screen feature width the CIGAR walk is collapsed to a single
// segment — sub-pixel CIGAR ops aren't visible anyway, and skipping them is the
// dominant frame-time win at zoomed-out views. Kept in step with MIN_INDEL_PX
// (the per-op gate that drops sub-pixel indels within a block) so
// small-but-visible blocks still show detail rather than being flattened.
//
// Single source of truth for both sides of the RPC boundary: the worker uses it
// to decide whether a feature's CIGAR is worth parsing and shipping at all, and
// the geometry builder uses it to decide whether to walk the one it received.
export const MIN_CIGAR_PX_WIDTH = 2

// The CIGAR operator a hovered SEGMENT is, and how long, or undefined — which is
// the answer for most segments and every zoomed-out one.
//
// Only indels are reported, the same three kinds
// `LinearSyntenyDisplay`'s `getCigarOpAtInstance` reports and for the same
// reason: a match segment's op is the un-newsworthy default (a whole-feature
// line with no CIGAR at all is stored as CIGAR_M too), so naming it would put a
// line on every tooltip that says nothing.
//
// The length is the span of whichever axis advanced — D and N advance the
// reference, I advances the query, and the other axis stays a point — so the max
// of the two absolute spans is it, with no need to store a length per segment.
// Same derivation as the synteny twin, off different fields.
export function segmentCigarOp(
  data: {
    segmentOps: Uint8Array
    x1: Float64Array
    x2: Float64Array
    y1: Float64Array
    y2: Float64Array
  },
  segmentIdx: number,
) {
  const op = data.segmentOps[segmentIdx]
  if (op === undefined || !((1 << op) & CIGAR_INDEL_MASK)) {
    return undefined
  }
  const length = Math.round(
    Math.max(
      Math.abs(data.x2[segmentIdx]! - data.x1[segmentIdx]!),
      Math.abs(data.y2[segmentIdx]! - data.y1[segmentIdx]!),
    ),
  )
  return { op: CIGAR_OP_LETTER[op]!, length }
}

// The worker decides using the bpPerPx of the fetch, but geometry is rebuilt on
// the main thread from held rpcData whenever zoom changes — and a zoom-in only
// refetches after the debounce. Without headroom, a feature just under the
// threshold at fetch time would arrive with no CIGAR and then be zoomed past the
// threshold, showing flat blocks until the refetch landed. 8x covers three
// button zoom-ins (2x each) inside that window.
const ZOOM_HEADROOM = 8

// Whether the worker should parse and ship this feature's CIGAR: true once the
// alignment is within zoom-headroom of being wide enough for the geometry
// builder to walk it.
export function cigarWorthParsing(
  hSpanBp: number,
  vSpanBp: number,
  bpPerPxH: number,
  bpPerPxV: number,
) {
  const widthPx = Math.max(
    Math.abs(hSpanBp) / bpPerPxH,
    Math.abs(vSpanBp) / bpPerPxV,
  )
  return widthPx >= MIN_CIGAR_PX_WIDTH / ZOOM_HEADROOM
}
