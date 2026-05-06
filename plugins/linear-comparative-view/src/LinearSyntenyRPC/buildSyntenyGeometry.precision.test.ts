import { buildSyntenyGeometry } from './buildSyntenyGeometry.ts'

// Reproduces the cross-chromosome off-screen-mate scenario that motivated
// the hp-math switch: top corner is visible (~10 kbp into chr1) but the
// mate is on a distant chromosome (~800 Mbp cumulative). The old pipeline
// stored the bottom corner as a Float32 pixel position around 8e8 px, which
// had ~64 px quantization error that got amplified by the shader's
// `* scale` compensation when the cached geometry was at a different
// bpPerPx than the current view. Storing cum-bp as hi/lo Float32 round-
// trips losslessly at 4096-bp granularity (lo carries the 12 LSBs).
function reconstruct(hi: number, lo: number) {
  return hi + lo
}

function buildOne(opts: {
  topPx: number
  botPx: number
  bpPerPx0: number
  bpPerPx1: number
  padTop?: number
  padBottom?: number
}) {
  const { topPx, botPx, bpPerPx0, bpPerPx1, padTop = 0, padBottom = 0 } = opts
  return buildSyntenyGeometry({
    p11_offsetPx: new Float64Array([topPx]),
    p12_offsetPx: new Float64Array([topPx + 100 / bpPerPx0]),
    p21_offsetPx: new Float64Array([botPx]),
    p22_offsetPx: new Float64Array([botPx + 100 / bpPerPx1]),
    padTop: new Float64Array([padTop]),
    padBottom: new Float64Array([padBottom]),
    strands: new Int8Array([1]),
    names: [''],
    parsedCigars: [[]],
    starts: new Uint32Array([0]),
    ends: new Uint32Array([100]),
    drawCIGAR: false,
    drawCIGARMatchesOnly: false,
    drawLocationMarkers: false,
    bpPerPx0,
    bpPerPx1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 1000,
  })
}

test('cross-chromosome off-screen mate: hi/lo round-trips to exact cum-bp', () => {
  // Mate at 800 Mbp with bpPerPx=1 → 8e8 px. The full cum-bp must be
  // recoverable from the hi/lo split with sub-bp precision. (Strand=1 maps
  // p21 → bp4 and p22 → bp3 in the addInstance call.)
  const g = buildOne({ topPx: 10_000, botPx: 8e8, bpPerPx0: 1, bpPerPx1: 1 })

  expect(reconstruct(g.bp1Hi[0]!, g.bp1Lo[0]!)).toBe(10_000)
  // Float32(8e8) alone has 64 px ULP — hi (4096-multiple) + lo (< 4096)
  // reconstructs exactly. Test bp4 since bp3 picks up the +100 width.
  expect(reconstruct(g.bp4Hi[0]!, g.bp4Lo[0]!)).toBe(8e8)
  expect(reconstruct(g.bp3Hi[0]!, g.bp3Lo[0]!)).toBe(8e8 + 100)
})

test('re-fetched geometry at different bpPerPx produces identical cum-bp', () => {
  // Same feature at the same cum-bp position, fetched at two different
  // bpPerPx — stored cum-bp is invariant. (The old pixel-space output
  // jumped between fetches because Float32(8e7)*10 ≠ Float32(8e8).)
  const a = buildOne({ topPx: 1_000, botPx: 8e7, bpPerPx0: 10, bpPerPx1: 10 })
  const b = buildOne({ topPx: 10_000, botPx: 8e8, bpPerPx0: 1, bpPerPx1: 1 })
  expect(reconstruct(a.bp4Hi[0]!, a.bp4Lo[0]!)).toBe(8e8)
  expect(reconstruct(b.bp4Hi[0]!, b.bp4Lo[0]!)).toBe(8e8)
})

test('padding survives as a small Float32 separately from the cum-bp', () => {
  const g = buildOne({
    topPx: 10_000 + 50, // 50 px of padding accumulated before this region
    botPx: 8e8 + 200,
    bpPerPx0: 1,
    bpPerPx1: 1,
    padTop: 50,
    padBottom: 200,
  })
  expect(g.padTops[0]).toBe(50)
  expect(g.padBottoms[0]).toBe(200)
  // cum-bp is `(px - pad) * bpPerPx` — padding is stripped from the bp value
  expect(reconstruct(g.bp1Hi[0]!, g.bp1Lo[0]!)).toBe(10_000)
  expect(reconstruct(g.bp4Hi[0]!, g.bp4Lo[0]!)).toBe(8e8)
})
