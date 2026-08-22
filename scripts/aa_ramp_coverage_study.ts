#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Which of `antialias.slang`'s two ramp shapes is closer to a box filter.
 *
 * `antialias.slang` offered two shapes over exactly one output pixel — `aaRamp`
 * (linear in the signed distance) and `aaSmoothRamp` (the smoothstep cubic) —
 * and the tree ran both, dotplot's capsule taking the cubic where wiggle's
 * identically-shaped capsule took the linear. The choice was never made against
 * a reference, only argued: linear "is what a box filter produces", cubic "reads
 * softer on a curve".
 *
 * This measured it, and the cubic lost at every angle, so the four shaders that
 * took it moved onto `aaRamp` and the cubic is no longer in the tree. Both
 * shapes are modelled here in JS, so the comparison is still runnable and this
 * script is where the smoothstep form is now written down.
 *
 * Exact coverage of the unit pixel square by a half plane
 * is integrated on a fine sub-grid — obviously right rather than cleverly
 * right — and both ramps are scored against it as a function of the edge's
 * signed perpendicular distance from the pixel centre. The band table then
 * covers the case where a mark is thin enough that its two edge ramps overlap,
 * in both constructions the tree uses: `ramp(halfWidth - |d|)` (dotplot,
 * wiggle, synteny's outline) and `ramp(d) - ramp(d - h)` (synteny's
 * vertCoverage).
 *
 * Reported in GPU_RENDERING.md's antialiasing section; rerun it rather than
 * trusting the numbers quoted there.
 */

// Samples per axis for the reference integration. 2048 puts the quadrature
// noise at 1e-4, two orders below the difference being measured.
const N = 2048
const ANGLES_DEG = [0, 11.25, 22.5, 33.75, 45]
const STEPS = 401

/**
 * Area of the unit pixel square inside the half plane whose edge sits at
 * signed perpendicular distance `d` from the pixel centre, at angle `theta`.
 * Positive `d` means the pixel centre is inside.
 */
function exactCoverage(d: number, theta: number) {
  const nx = Math.cos(theta)
  const ny = Math.sin(theta)
  let inside = 0
  for (let i = 0; i < N; i++) {
    const x = -0.5 + (i + 0.5) / N
    for (let j = 0; j < N; j++) {
      const y = -0.5 + (j + 0.5) / N
      if (x * nx + y * ny + d >= 0) {
        inside++
      }
    }
  }
  return inside / (N * N)
}

/** `aaRamp(signedInk, 1.0)` — the ramp one output pixel wide. */
const linear = (d: number) => Math.min(1, Math.max(0, d + 0.5))

/** The retired `aaSmoothRamp(signedInk, 0.5)` — the same support, cubic. */
const smooth = (d: number) => {
  const t = Math.min(1, Math.max(0, d + 0.5))
  return t * t * (3 - 2 * t)
}

console.log('One straight edge, error against exact area coverage:\n')
console.log('  angle      RMS linear   RMS cubic   max linear   max cubic')
for (const deg of ANGLES_DEG) {
  const theta = (deg * Math.PI) / 180
  let sqLin = 0
  let sqSmooth = 0
  let maxLin = 0
  let maxSmooth = 0
  for (let k = 0; k < STEPS; k++) {
    const d = -1 + (2 * k) / (STEPS - 1)
    const truth = exactCoverage(d, theta)
    const eLin = linear(d) - truth
    const eSm = smooth(d) - truth
    sqLin += eLin * eLin
    sqSmooth += eSm * eSm
    maxLin = Math.max(maxLin, Math.abs(eLin))
    maxSmooth = Math.max(maxSmooth, Math.abs(eSm))
  }
  console.log(
    `  ${`${deg}°`.padStart(6)}   ${Math.sqrt(sqLin / STEPS)
      .toFixed(5)
      .padStart(10)}   ${Math.sqrt(sqSmooth / STEPS)
      .toFixed(5)
      .padStart(9)}   ${maxLin.toFixed(5).padStart(10)}   ${maxSmooth
      .toFixed(5)
      .padStart(9)}`,
  )
}

console.log(
  '\nA band of width W centred on the pixel, axis aligned (truth = min(W, 1)):\n',
)
console.log('       W   truth   ramp(d)-ramp(d-W)      ramp(W/2-|d|)')
console.log('                    linear    cubic     linear    cubic')
for (const W of [0.25, 0.5, 0.75, 1, 1.5]) {
  const truth = Math.min(W, 1)
  console.log(
    `  ${String(W).padStart(6)}   ${truth.toFixed(3)}   ${(
      linear(W / 2) - linear(-W / 2)
    )
      .toFixed(3)
      .padStart(6)}   ${(smooth(W / 2) - smooth(-W / 2))
      .toFixed(3)
      .padStart(6)}   ${linear(W / 2)
      .toFixed(3)
      .padStart(8)}   ${smooth(W / 2)
      .toFixed(3)
      .padStart(6)}`,
  )
}
