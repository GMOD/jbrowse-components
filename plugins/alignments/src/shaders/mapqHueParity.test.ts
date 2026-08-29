import { colord } from '@jbrowse/core/util/colord'

import { getReadColor } from '../LinearAlignmentsDisplay/colorUtils.ts'
import { ColorScheme } from '../LinearAlignmentsDisplay/constants.ts'
import { makeTestPalette } from '../LinearAlignmentsDisplay/testUtils.ts'
import { hueRampLane } from './slang/alignmentsUniforms.js.generated.ts'

// The MAPQ read fill is the one read category that is a per-read ramp rather
// than a palette slot, and the two backends reach it by routes that share no
// arithmetic: the GPU runs `hueRampHalfSat`'s hand-rolled chroma/sector sweep
// (alignmentsUniforms.slang), while Canvas2D hands the browser
// `hsl(mapq,50%,50%)` and lets CSS resolve it. Nothing had ever compared them.
//
// `hueRampLane` is the scalar the shader was factored onto so this test could
// import the sector arithmetic instead of restating it — a test that re-spelled
// the formula would pass against a shader painting something else (adr-051
// §"A vector signature is usually a scalar decision in a wrapper"; the
// sBlend/yCurve oracle is the precedent). The CSS side is resolved by
// `colord`, whose HSL is the spec's p/q formulation over `color-bits` — a
// second implementation that deliberately does not look like the first.
const palette = makeTestPalette()

function readMapqCss(mapq: number) {
  return getReadColor(
    0,
    {
      readStrands: Int8Array.of(1),
      readFlags: Uint16Array.of(0),
      readMapqs: Uint8Array.of(mapq),
      readInsertSizes: Float32Array.of(0),
      readPairOrientations: Uint8Array.of(0),
      readTagColors: Uint32Array.of(0),
      readChainHasSupp: Uint8Array.of(0),
      readInterchrom: Uint8Array.of(0),
    },
    ColorScheme.mappingQuality,
    palette,
  )
}

// 255 is "unavailable" and leaves the ramp for a neutral swatch, so the ramp's
// domain is 0..254 — colorUtils.test.ts pins that boundary itself.
const MAPQ_RAMP_MAX = 254

test('the shader ramp and the CSS hsl() agree on every MAPQ', () => {
  const mismatches: string[] = []
  for (let mapq = 0; mapq <= MAPQ_RAMP_MAX; mapq++) {
    const { r, g, b } = colord(readMapqCss(mapq)).toRgb()
    const shader = [0, 1, 2].map(lane =>
      Math.round(255 * hueRampLane(mapq, lane)),
    )
    // The two formulations are algebraically equal but differ in operation
    // order, so a channel landing on an exact half-integer can round apart by
    // one. A real defect — a sector boundary off by one, a swapped lane — is
    // tens of counts, not one (adr-051: parity tests assert behavior, not bit
    // patterns).
    const css = [r, g, b]
    if (css.some((v, i) => Math.abs(v - shader[i]!) > 1)) {
      mismatches.push(`mapq ${mapq}: css ${css} vs shader ${shader}`)
    }
  }
  expect(mismatches).toEqual([])
})

test('the ramp actually sweeps hue rather than answering one color', () => {
  // Guards the case where both sides degenerate together — a constant twin
  // would satisfy the comparison above against a constant CSS string.
  const seen = new Set(
    Array.from({ length: MAPQ_RAMP_MAX + 1 }, (_, mapq) => readMapqCss(mapq)),
  )
  expect(seen.size).toBe(MAPQ_RAMP_MAX + 1)
})

test('the six sector boundaries land where the hue wheel says', () => {
  // hp = mapq/360*6 crosses a sector at every 60 degrees. These are the
  // samples where the shader's branch chain and the CSS parser's piecewise
  // ramp are most likely to disagree, and where an off-by-one in a comparison
  // would otherwise hide between the coarse sweep's steps.
  for (const deg of [0, 60, 120, 180, 240]) {
    const { r, g, b } = colord(readMapqCss(deg)).toRgb()
    const shader = [0, 1, 2].map(lane =>
      Math.round(255 * hueRampLane(deg, lane)),
    )
    expect([r, g, b]).toEqual(shader)
  }
})
