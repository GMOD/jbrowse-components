import {
  VIRIDIS_STOPS,
  buildColorRampLut,
  stopsFromRampLut,
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

// Viridis is the full 256-stop spec (shared with wiggle density via
// @jbrowse/core/util/colorRamp) so the heatmap gets the smooth
// perceptually-uniform gradient; legends read an 11-stop subset out of the
// built LUT, so a legend swatch is byte-identical to a heatmap entry.
const SCHEMES: Record<HicColorScheme, readonly RGBA[]> = {
  fall: FALL_STOPS,
  juicebox: JUICEBOX_STOPS,
  viridis: VIRIDIS_STOPS,
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

const LEGEND_STOP_COUNT = 11

// 11 evenly-spaced legend stops read out of the ramp bytes the GPU uploads —
// entry round(t * 255), the same index math stopsFromRampLut uses for the SVG
// stops below, so the CSS and SVG legends and the heatmap are one table.
export function getLegendStops(colorScheme: HicColorScheme) {
  const ramp = RAMPS[colorScheme]
  const out: { offset: number; rgba: RGBA }[] = []
  for (let i = 0; i < LEGEND_STOP_COUNT; i++) {
    const t = i / (LEGEND_STOP_COUNT - 1)
    const o = Math.round(t * 255) * 4
    out.push({
      offset: t,
      rgba: [ramp[o]!, ramp[o + 1]!, ramp[o + 2]!, ramp[o + 3]!],
    })
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

// The SVG legend stops, via the shared helper over the same uploaded bytes.
// Alpha rides stop-opacity there, which is what keeps the juicebox scheme's
// transparent→opaque fade through exporters with uneven rgba() support.
export function getLegendSvgStops(colorScheme: HicColorScheme) {
  return stopsFromRampLut(RAMPS[colorScheme], LEGEND_STOP_COUNT)
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
