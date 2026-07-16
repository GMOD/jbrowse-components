import { namedColorToHex } from './color/cssColorsLevel4.ts'
import {
  getAlpha,
  getBlue,
  getGreen,
  getRed,
  newColor,
  parse,
} from './color-bits/index.ts'

import type { Color } from './color-bits/index.ts'
import type { Feature } from './simpleFeature.ts'

export {
  alpha,
  blend,
  darken,
  formatHEX,
  formatHEXA,
  formatRGBA,
  getAlpha,
  getBlue,
  getGreen,
  getLuminance,
  getRed,
  lighten,
  newColor,
  parse,
  toHSLA,
  toRGBA,
} from './color-bits/index.ts'
export type { Color } from './color-bits/index.ts'

// Magenta sentinel for invalid input. User-written jexl color callbacks can
// legitimately return undefined (e.g. when a feature lacks the field they
// reference); crashing the worker on `undefined.trim()` was the failure mode.
// Returning magenta makes the bad slot visually obvious without breaking the
// rest of the render.
const INVALID_COLOR = newColor(255, 0, 255, 255)

// A bare BED color triple ("255,0,0"), which is not a CSS color but is what
// BED-family adapters put on the feature verbatim. The spec has no spaces, but
// tolerate them rather than silently ignoring an otherwise-usable color.
const BED_TRIPLE = /^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/

// UCSC's convention is that a color of "0" means "no color specified", and plain
// BED12 files fill the column with that placeholder (often spelled as the
// all-zero triple) rather than omitting it — every itemRgb in our own
// volvox-bed12 fixture is "0,0,0". Honoring those literally would paint an
// ordinary BED12 track solid black, so read them as absent. A file that really
// wants black can say so with an explicit `color` slot.
const BED_TRIPLE_UNSET = /^0(,0,0)?$/

/**
 * Normalize a bare BED color triple to canonical "r,g,b", or undefined if the
 * string isn't one. Each component must be in range: the underlying parser
 * masks to 8 bits, so a bogus "999,0,0" would otherwise *wrap* to 231 and paint
 * a plausible-looking but wrong color rather than being caught.
 */
function bedTriple(str: string): string | undefined {
  const m = BED_TRIPLE.exec(str.trim())
  const rgb = m?.slice(1, 4).map(Number)
  return rgb?.every(n => n <= 255) ? rgb.join(',') : undefined
}

/**
 * One raw attribute value as a usable BED color, or undefined when it isn't
 * one. Deliberately strict: this feeds an *automatic* coloring path, so a value
 * is only claimed when it is unambiguously an in-range BED triple. Anything
 * else — a hex string, a `reserved` column holding something that isn't a color
 * at all — reads as absent and leaves the configured default alone, rather than
 * rendering as the magenta invalid-color sentinel. Takes the raw value so it
 * stays dependency-free and directly testable.
 */
export function featureItemRgb(raw: unknown): string | undefined {
  const triple = typeof raw === 'string' ? bedTriple(raw) : undefined
  return triple !== undefined && !BED_TRIPLE_UNSET.test(triple)
    ? triple
    : undefined
}

// The two names the BED color column goes by. `itemRgb` is the BED spec's name;
// `reserved` is what UCSC's canonical autoSql calls it ("uint reserved; Used as
// itemRgb as of 2004-11-22"). bigBed/bigGenePred files embed that autoSql and
// BigBedAdapter takes its field names from it, so their features come out
// carrying `reserved` — the very case #1734 asks about.
const BED_COLOR_FIELDS = ['itemRgb', 'reserved']

/**
 * The BED color a feature declares for itself, under either column name, or
 * undefined if it declares none.
 */
export function featureBedColor(feature: Feature): string | undefined {
  let found: string | undefined
  for (const field of BED_COLOR_FIELDS) {
    found ??= featureItemRgb(feature.get(field))
  }
  return found
}

// Resolve a CSS color string to a Color: honors named colors, `transparent`,
// and bare BED color triples, and returns `fallback` on malformed-but-nonempty
// input. `parse` throws on e.g. an empty "rgb()"; callers pass a fallback so one
// bad per-feature color can't crash a whole render/RPC. An out-of-range triple
// is left to throw into `fallback` (magenta) rather than wrapping to a wrong
// color — the same rule featureItemRgb applies, so a jexl callback reading an
// itemRgb column and the automatic path agree on what counts as a color.
export function parseCssColorOr(color: string, fallback: Color): Color {
  const str = color.trim().toLowerCase()
  if (str === 'transparent') {
    return newColor(0, 0, 0, 0)
  }
  try {
    const hex = namedColorToHex(str)
    const triple = bedTriple(str)
    return parse(hex ? hex : triple ? `rgb(${triple})` : str)
  } catch {
    return fallback
  }
}

export function parseCssColor(color: string | undefined | null) {
  if (typeof color !== 'string' || color.length === 0) {
    return INVALID_COLOR
  }
  return parseCssColorOr(color, INVALID_COLOR)
}

export function cssColorToNormalizedRgb(
  color: string,
): [number, number, number] {
  const c = parseCssColor(color)
  return [getRed(c) / 255, getGreen(c) / 255, getBlue(c) / 255]
}

export function cssColorToRgb(color: string): [number, number, number] {
  const c = parseCssColor(color)
  return [getRed(c), getGreen(c), getBlue(c)]
}

export function cssColorToRgba(
  color: string,
): [number, number, number, number] {
  const c = parseCssColor(color)
  return [getRed(c), getGreen(c), getBlue(c), getAlpha(c)]
}

// Pack 0..255 RGBA channel bytes into an ABGR u32 (R at byte 0, A at byte 3).
// >>> 0 keeps the result an unsigned 32-bit — bit 31 (alpha's top bit) would
// otherwise make opaque colors negative in JS.
export function packAbgr(r: number, g: number, b: number, a: number) {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
}

export function cssColorToABGR(color: string) {
  const c = parseCssColor(color)
  return packAbgr(getRed(c), getGreen(c), getBlue(c), getAlpha(c))
}

// Replace the alpha byte of an ABGR-packed u32, keeping its RGB. RGB already
// occupies the low 24 bits (b<<16 | g<<8 | r), so this is a mask + or — no
// per-channel unpack/repack. >>> 0 keeps the result unsigned (see packAbgr).
export function withAbgrAlpha(c: number, a: number) {
  return ((c & 0x00ffffff) | (a << 24)) >>> 0
}

// Pack a 0..1 normalized RGB triple into an ABGR u32 (opaque alpha). Inverse
// of cssColorToNormalizedRgb at the GPU write boundary — the shader side
// unpacks with unpackRGBA() (see packages/render-core/src/shaders/colorPack.slang).
export function normalizedRgbToABGR(r: number, g: number, b: number) {
  return packAbgr(
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255),
    255,
  )
}

// Format a 0..1 normalized RGB triple as a CSS `rgb(r,g,b)` string.
export function normalizedRgbToCss(c: readonly [number, number, number]) {
  return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`
}

// Format a 0..1 normalized RGB triple + alpha as a CSS `rgba(r,g,b,a)` string.
// Preferred over `ctx.globalAlpha = a; fillStyle = rgb(...)` bracketing.
export function normalizedRgbToCssRgba(
  c: readonly [number, number, number],
  alpha: number,
) {
  return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${alpha})`
}

// Set fillStyle from an ABGR-packed u32.
export function setAbgrFill(
  ctx: { fillStyle: string | CanvasGradient | CanvasPattern },
  c: number,
) {
  ctx.fillStyle = abgrToCssRgba(c)
}

// Channel accessors for the ABGR packed layout (R at byte 0, A at byte 3 —
// the layout produced by cssColorToABGR and consumed by GPU shaders that
// unpack via bit shifts from a u32 vertex attribute). Mirror of the
// color-bits getRed/Green/Blue/Alpha, which operate on the canonical
// 0xRRGGBBAA layout and therefore give wrong results if called on an ABGR
// value.
export function abgrRed(c: number) {
  return c & 0xff
}
export function abgrGreen(c: number) {
  return (c >>> 8) & 0xff
}
export function abgrBlue(c: number) {
  return (c >>> 16) & 0xff
}
export function abgrAlpha(c: number) {
  return (c >>> 24) & 0xff
}

// Format an ABGR-packed u32 as a CSS rgba() string.
export function abgrToCssRgba(c: number) {
  return `rgba(${abgrRed(c)},${abgrGreen(c)},${abgrBlue(c)},${abgrAlpha(c) / 255})`
}

export function cssColorToNormalizedRgba(
  color: string,
): [number, number, number, number] {
  const c = parseCssColor(color)
  return [
    getRed(c) / 255,
    getGreen(c) / 255,
    getBlue(c) / 255,
    getAlpha(c) / 255,
  ]
}
