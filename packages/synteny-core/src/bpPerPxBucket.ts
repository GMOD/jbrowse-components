// The zoom a comparative fetch key carries: a log2 bucket, so the key refires
// once per doubling instead of on every wheel notch.
//
// Both comparative displays need SOME zoom term — synteny because its worker
// sizes a px cull at fetch time (zooming out ~2x can leave features missing
// beyond the previous cull window), dotplot because `cigarWorthParsing` decides
// per feature whether the CIGAR is worth shipping. Neither needs the exact
// value, and carrying it makes the key flip on a zoom that changes nothing the
// fetch brings back.
//
// The bucket admits at most a 2x zoom-in against held data. Dotplot's
// `ZOOM_HEADROOM` is 8x, so three quarters of that margin is still available for
// the debounce window it was actually sized for.
//
// Where this does and does not pay, measured on a 250Mb chromosome at 800px:
// zoomed out far enough that `syntenyFetchRegions` clamps its window to the
// whole displayed region, the window term is constant and this is the only
// thing left moving — a 40-notch wheel fling over that range went from 26 keys
// to 4. Zoomed in past the clamp, the snap grid is `panBufferPx * bpPerPx` and
// so moves with every zoom on its own; there this changes nothing, and neither
// would any other zoom term. That is the right way round: the clamped regime is
// the whole-genome one, where the fetch is every alignment in the file.
//
// The floor at 1 collapses all sub-bp/px zooms into one bucket. At base level
// every alignment on screen is wide enough to be worth its CIGAR, so there is
// nothing left for the term to decide.
export function bucketBpPerPx(bpPerPx: number) {
  return Math.floor(Math.log2(Math.max(bpPerPx, 1)))
}
