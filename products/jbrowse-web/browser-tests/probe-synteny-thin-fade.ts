/* eslint-disable no-console */
// The two sub-pixel fade models, side by side, for one ribbon.
//
// A sub-pixel ribbon is drawn as a ~1px band whose ALPHA carries how much of a
// pixel it really covers (thinWidthFade). The GPU computes that per fragment
// from the LOCAL perpendicular width; Canvas2D computes it once per ribbon from
// the chord. In straight mode those are the same number. On a bezier they are
// not: the x-curve's tangent is vertical at both ends and twice the chord slope
// at the middle, so the local perpendicular width swings by ~8x along a
// long-range ribbon while the whole-ribbon estimate stays put.
//
// Per row both backends lay down the same horizontal extent (each follows the
// same path at the same local slope), so the extent cancels and the visible
// ratio is just the two fades.
const sBlendDeriv = (t: number) => 6 * t * (1 - t)
const yCurveDeriv = (t: number) => 1.5 - 3 * t + 3 * t * t
const WIDTH_FADE_FLOOR = 0.15
const fade = (perpW: number) => Math.min(Math.max(perpW, WIDTH_FADE_FLOOR), 1)

interface Ribbon {
  label: string
  travelPx: number // horizontal distance between the ribbon's two ends
  widthPx: number // the alignment's own width on screen
  heightPx: number // the level height
}

// GPU: perpCoverage's per-fragment width, at bezier parameter t.
function gpuFadeAt(r: Ribbon, t: number, curve: boolean) {
  const sd = curve ? sBlendDeriv(t) : 1
  const dydt = curve ? r.heightPx * yCurveDeriv(t) : r.heightPx
  const slope = (r.travelPx * sd) / Math.abs(dydt)
  const perpFactor = Math.hypot(1, slope)
  return fade(r.widthPx / perpFactor)
}

// Canvas2D: ribbonPerpWidth, once, off the centerline chord.
function canvasFade(r: Ribbon) {
  const perpFactor = Math.hypot(1, r.travelPx / r.heightPx)
  return fade(r.widthPx / perpFactor)
}

const ribbons: Ribbon[] = [
  // hs1 vs mm39 whole-genome: 3.1 Gbp over ~1388px is ~2.23 Mbp/px, so the
  // 500kb minimum alignment is 0.22px wide. Travel is how far apart the two
  // ends sit, i.e. how rearranged that block is.
  {
    label: 'hs1/mm39, collinear block',
    travelPx: 20,
    widthPx: 0.224,
    heightPx: 350,
  },
  {
    label: 'hs1/mm39, half-frame rearrangement',
    travelPx: 700,
    widthPx: 0.224,
    heightPx: 350,
  },
  {
    label: 'hs1/mm39, full-frame rearrangement',
    travelPx: 1388,
    widthPx: 0.224,
    heightPx: 350,
  },
  // grape vs peach: ~500 Mbp over 1388px, 2kb minimum -> 0.006px, and the
  // genomes are collinear enough that travel stays small.
  {
    label: 'grape/peach, collinear block',
    travelPx: 20,
    widthPx: 0.006,
    heightPx: 350,
  },
  {
    label: 'grape/peach, half-frame rearrangement',
    travelPx: 700,
    widthPx: 0.006,
    heightPx: 350,
  },
]

for (const curve of [true, false]) {
  console.log(`\ndrawCurves=${curve}`)
  console.log(
    '  ribbon                                canvas2d   gpu@end  gpu@mid   worst ratio',
  )
  for (const r of ribbons) {
    const c = canvasFade(r)
    const end = gpuFadeAt(r, 0.02, curve)
    const mid = gpuFadeAt(r, 0.5, curve)
    const worst = Math.max(end / c, c / end, mid / c, c / mid)
    console.log(
      `  ${r.label.padEnd(38)}${c.toFixed(3).padStart(7)}${end
        .toFixed(3)
        .padStart(10)}${mid.toFixed(3).padStart(9)}${worst
        .toFixed(2)
        .padStart(12)}x`,
    )
  }
}
console.log(
  '\nsBlendDeriv/yCurveDeriv peaks at 2.0 (t=0.5) and is 0 at both ends, so a\n' +
    'curved ribbon is at its widest perpendicular where it meets the frame and\n' +
    'its thinnest halfway down. One number per ribbon cannot say that.',
)
// No imports of its own, so say it is a module: these names are also spelled in
// syntenyFillPad.test.ts, and a bare script shares their scope.
export {}
