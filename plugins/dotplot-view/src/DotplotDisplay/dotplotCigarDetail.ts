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
