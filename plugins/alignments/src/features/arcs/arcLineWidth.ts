// How thick an arc is drawn for the number of reads that support it.
//
// Identical connections are coalesced into one arc carrying a `support` count
// (`resolveArcs`), so this is the one place that turns that count into ink. It
// is a plain TS function rather than a shader export because the GPU reads the
// width as a per-instance attribute the packer has already resolved: one curve,
// evaluated once per arc on the CPU, consumed by Canvas2D, the SVG export and
// the vertex stage alike.
//
// LOG, NOT LINEAR. Support at one junction routinely differs by an order of
// magnitude from its neighbour's — over the HG002 chr12 fold-back a 27-read
// junction sits 689 bp from a 6-read one — and a linear map either draws the
// minority junction as a hairline or the majority as a band wider than the
// features under it. Doubling the read count adds a fixed amount of width, so
// 1 -> 2 reads is as visible a step as 16 -> 32.
//
// A SINGLE READ KEEPS THE CONFIGURED WIDTH, which is what makes this safe to
// turn on for every existing figure: `readConnectionsLineWidth` is still
// exactly what a support-1 arc draws, so a view whose arcs are all singletons
// is pixel-identical to what it was before coalescing existed.
export const ARC_WIDTH_PER_DOUBLING = 0.55

// Ceiling in multiples of the configured width. Without one a deep amplicon
// (support in the thousands) draws an arc thicker than the band is tall, and
// the band is sized from the arc apexes rather than from the strokes.
//
// The two constants together fix where the curve stops rising:
// 2^((MAX_SCALE - 1) / PER_DOUBLING) = 2^(3/0.55), i.e. about 44 reads — past
// the point where more ink says anything, and still well above the support a
// junction in an ordinary pileup carries. `arcLineWidth.test.ts` pins that
// crossover, because it is a derived number and this comment said 128 for a
// while (the width AT 128, 4.85x, read back as the width the cap is).
export const ARC_WIDTH_MAX_SCALE = 4

export function arcLineWidth(support: number, baseWidth: number) {
  if (support <= 1) {
    return baseWidth
  }
  const scale = 1 + ARC_WIDTH_PER_DOUBLING * Math.log2(support)
  return baseWidth * Math.min(scale, ARC_WIDTH_MAX_SCALE)
}
