import { COLOR_RAMP_LUT_ENTRIES } from '@jbrowse/render-core/colorRampLut'

import type { GradientStop } from '../ui/SvgGradientLegend.tsx'

/** One evenly-spaced ramp stop: 8-bit red, green, blue, alpha. */
export type ColorRampStop = readonly [number, number, number, number]

// Viridis full 256-color hex spec, kept whole so a LUT built from these stops
// carries the smooth perceptually-uniform gradient rather than an
// interpolation over a subset. Lived in the hic plugin until wiggle density
// gained the same named ramp; both build their 256×1 GPU/Canvas2D LUTs from
// this one table.
const VIRIDIS_HEX_SPEC =
  '44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725'

function viridisStopsFromHex(): ColorRampStop[] {
  const out: ColorRampStop[] = []
  for (let i = 0; i < 256; i++) {
    const hex = VIRIDIS_HEX_SPEC.slice(i * 6, i * 6 + 6)
    out.push([
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
      255,
    ])
  }
  return out
}

/**
 * #api
 * The 256 viridis stops, fully opaque. Feed them to {@link buildColorRampLut}
 * for the texture/fillStyle form, or to {@link sampleColorRamp} for legend
 * stops.
 */
export const VIRIDIS_STOPS: readonly ColorRampStop[] = viridisStopsFromHex()

function lerp8(a: number, b: number, t: number) {
  return Math.round(a * (1 - t) + b * t)
}

/**
 * #api
 * The color at `t` in `[0, 1]` across a list of EVENLY SPACED stops, linearly
 * interpolated per channel. `t` is clamped, so the ends are the end stops
 * rather than an extrapolation past them, and a one-stop ramp is that stop
 * everywhere.
 */
export function sampleColorRamp(stops: readonly ColorRampStop[], t: number) {
  const position = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const lower = Math.floor(position)
  const lo = stops[lower]!
  const hi = stops[Math.min(lower + 1, stops.length - 1)]!
  const frac = position - lower
  return [
    lerp8(lo[0], hi[0], frac),
    lerp8(lo[1], hi[1], frac),
    lerp8(lo[2], hi[2], frac),
    lerp8(lo[3], hi[3], frac),
  ] as ColorRampStop
}

/**
 * #api
 * An RGBA lookup table over {@link sampleColorRamp}, laid out as the Nx1
 * texture both GPU backends upload and the Canvas2D twins index — entry `i` is
 * the color at `t = i / (N - 1)`. N comes off the shader that samples it, so
 * the table and `rampColor`'s texel mapping cannot disagree.
 */
export function buildColorRampLut(stops: readonly ColorRampStop[]) {
  const last = COLOR_RAMP_LUT_ENTRIES - 1
  const data = new Uint8Array(COLOR_RAMP_LUT_ENTRIES * 4)
  for (let i = 0; i < COLOR_RAMP_LUT_ENTRIES; i++) {
    const [r, g, b, a] = sampleColorRamp(stops, i / last)
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = a
  }
  return data
}

/**
 * #api
 * `n` evenly spaced legend stops read straight out of a
 * {@link buildColorRampLut} byte table — the same 256×1 RGBA array
 * `uploadColorRampLut` hands the GPU and the Canvas2D fillStyle LUTs index —
 * formatted for `SvgGradientLegend`. It holds one claim by construction: the
 * swatch at bar fraction `t` is byte-identical to the ramp entry at `t` on
 * both backends. Alpha rides `opacity` (the juicebox fade), never baked into
 * the color string.
 */
export function stopsFromRampLut(lut: Uint8Array, n: number): GradientStop[] {
  const lastEntry = lut.length / 4 - 1
  const out: GradientStop[] = []
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1)
    const o = Math.round(t * lastEntry) * 4
    out.push({
      offset: `${+(t * 100).toFixed(2)}%`,
      color: `rgb(${lut[o]!},${lut[o + 1]!},${lut[o + 2]!})`,
      opacity: lut[o + 3]! / 255,
    })
  }
  return out
}
