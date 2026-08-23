import {
  buildColorRampLut,
  sampleColorRamp,
} from '@jbrowse/core/util/colorRamp'
import { makeRampFillStyleLut } from '@jbrowse/render-core/canvas2dUtils'

import { MIN_VISIBLE_ALPHA } from './shaders/hic.consts.generated.ts'

import type { ColorRampStop } from '@jbrowse/core/util/colorRamp'

export type RGBA = ColorRampStop

// Single source of truth for each scheme. Used to build the GPU/Canvas2D
// 256x1 RGBA ramp AND the CSS/SVG legend gradients. Stops are evenly spaced,
// which is what `sampleColorRamp` interpolates between.
const FALL_STOPS: readonly RGBA[] = [
  [255, 255, 255, 255],
  [255, 255, 204, 255],
  [255, 237, 160, 255],
  [254, 217, 118, 255],
  [254, 178, 76, 255],
  [253, 141, 60, 255],
  [252, 78, 42, 255],
  [227, 26, 28, 255],
  [189, 0, 38, 255],
  [128, 0, 38, 255],
  [0, 0, 0, 255],
]

const JUICEBOX_STOPS: readonly RGBA[] = [
  [255, 0, 0, 0],
  [255, 0, 0, 255],
]

// Viridis full 256-color hex spec — kept for the GPU ramp so the heatmap has
// the smooth perceptually-uniform gradient. Legends use a 10-stop subset
// derived by sampling, so the legend visually matches the heatmap.
const VIRIDIS_HEX_SPEC =
  '44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725'

function viridisRgbaFromHex(): RGBA[] {
  const out: RGBA[] = []
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

const VIRIDIS_FULL_STOPS: readonly RGBA[] = viridisRgbaFromHex()

// One source of truth for the scheme names, their menu labels and the default:
// the config schema's `types.enumeration` spreads the value list, the track menu
// builds its radios off the same table, and its slot reads the constant — so
// adding a scheme is one edit here. `Record<HicColorScheme, …>` below makes that
// addition a type error until its stops exist. Order is menu order.
//
// The track menu's default entry writes DEFAULT_HIC_COLOR_SCHEME and relies on
// stripDefault omitting it (so picking it doesn't mark the track edited), which
// holds by construction now that the slot default *is* this constant.
export const HIC_COLOR_SCHEME_OPTIONS = [
  ['juicebox', 'Juicebox'],
  ['fall', 'Fall'],
  ['viridis', 'Viridis'],
] as const

export type HicColorScheme = (typeof HIC_COLOR_SCHEME_OPTIONS)[number][0]

export const HIC_COLOR_SCHEMES = HIC_COLOR_SCHEME_OPTIONS.map(
  ([value]) => value,
)

export const DEFAULT_HIC_COLOR_SCHEME: HicColorScheme = 'juicebox'

const SCHEMES: Record<HicColorScheme, readonly RGBA[]> = {
  fall: FALL_STOPS,
  juicebox: JUICEBOX_STOPS,
  viridis: VIRIDIS_FULL_STOPS,
}

// Derived from SCHEMES rather than listing the three names a third time, so the
// "adding a scheme is one edit" promise above actually holds: SCHEMES is the
// only table keyed by HicColorScheme, and its Record type makes a missing entry
// a type error.
const RAMPS = Object.fromEntries(
  Object.entries(SCHEMES).map(([name, stops]) => [
    name,
    buildColorRampLut(stops),
  ]),
) as Record<HicColorScheme, Uint8Array>

export function generateColorRamp(colorScheme: HicColorScheme): Uint8Array {
  return RAMPS[colorScheme]
}

// Sample 11 evenly-spaced legend stops from the same source as the GPU ramp.
export function getLegendStops(colorScheme: HicColorScheme) {
  const n = 11
  const scheme = SCHEMES[colorScheme]
  const out: { offset: number; rgba: RGBA }[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    out.push({ offset: t, rgba: sampleColorRamp(scheme, t) })
  }
  return out
}

// Flatten a ramp color onto a white legend background so the CSS gradient uses
// plain opaque stops. The juicebox scheme fades alpha 0->255; a translucent
// start stop rasterizes to a faint darker sliver at the bar's left edge, so
// compositing here keeps the legend a clean white->red with no such artifact.
function rgbOverWhite([r, g, b, a]: RGBA) {
  const t = a / 255
  const flat = (c: number) => Math.round(c * t + 255 * (1 - t))
  return `rgb(${flat(r)},${flat(g)},${flat(b)})`
}

export function getLegendCssGradient(colorScheme: HicColorScheme) {
  const stops = getLegendStops(colorScheme)
  const parts = stops.map(
    s => `${rgbOverWhite(s.rgba)} ${(s.offset * 100).toFixed(0)}%`,
  )
  return `linear-gradient(to right, ${parts.join(', ')})`
}

export function getLegendSvgStops(colorScheme: HicColorScheme) {
  const stops = getLegendStops(colorScheme)
  // Alpha goes in stop-opacity, not baked into an rgba() stop-color: SVG
  // stop-color alpha is unevenly supported by exporters, so the juicebox
  // scheme's transparent→opaque fade would otherwise flatten to solid color.
  return stops.map(s => ({
    offset: `${(s.offset * 100).toFixed(0)}%`,
    color: `rgb(${s.rgba[0]},${s.rgba[1]},${s.rgba[2]})`,
    opacity: s.rgba[3] / 255,
  }))
}

// Per-cell fillStyle LUT for the Canvas2D + SVG hic draw: returns the cached
// `rgba(...)` string for a normalized value `t`, or undefined where the ramp is
// effectively transparent (the juicebox scheme fades alpha→0 at low counts) so
// the caller skips painting that bin. The cutoff is hic-specific, so it stays
// out of the shared render-core LUT — but it is the SHADER's, generated from
// hic.slang's MIN_VISIBLE_ALPHA (adr-051), because the fragment discards on the
// same test and the two paths must not disagree about which bins exist.
export function makeHicFillStyleLut(ramp: Uint8Array) {
  const fill = makeRampFillStyleLut(ramp)
  // Precompute the transparent/opaque decision per ramp entry instead of
  // re-deriving it per call: this LUT runs once per painted contact per frame,
  // and `fill` already does its own index math. Reading the alpha byte here
  // (rather than via lookupColorRamp) also avoids allocating an {r,g,b,a} object
  // 256 times for a question that only needs one byte.
  const opaque = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    opaque[i] = ramp[i * 4 + 3]! / 255 < MIN_VISIBLE_ALPHA ? 0 : 1
  }
  return (t: number) => {
    const idx = Math.max(0, Math.min(255, Math.round(t * 255)))
    return opaque[idx] === 0 ? undefined : fill(t)
  }
}

// The count -> ramp-coordinate mapping that used to live here is now generated
// from hic.slang itself: `mapHicCount` in ./shaders/hic.js.generated.ts, via
// `//! js-export`. See adr-051 and hicShaderParity.test.ts.
