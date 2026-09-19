import { newColor } from './color-bits/core.ts'
import { parse } from './color-bits/parse.ts'
import { namedColorToHex } from './color/cssColorsLevel4.ts'

import type { Color } from './color-bits/core.ts'

// Split out of colorBits.ts so a config slot can ask "is this a color?" without
// taking that module's re-export of render-core's packers: the closure ceiling
// in scripts/moduleClosure.test.ts is what says so.

// A bare BED color triple ("255,0,0"), which is not a CSS color but is what
// BED-family adapters put on the feature verbatim. The spec has no spaces, but
// tolerate them rather than silently ignoring an otherwise-usable color.
const BED_TRIPLE = /^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/

/**
 * Normalize a bare BED color triple to canonical "r,g,b", or undefined if the
 * string isn't one. Each component must be in range: the underlying parser
 * masks to 8 bits, so a bogus "999,0,0" would otherwise *wrap* to 231 and paint
 * a plausible-looking but wrong color rather than being caught.
 */
export function bedTriple(str: string): string | undefined {
  const m = BED_TRIPLE.exec(str.trim())
  const rgb = m?.slice(1, 4).map(Number)
  return rgb?.every(n => n <= 255) ? rgb.join(',') : undefined
}

function tryParseCssColor(color: string): Color | undefined {
  const str = color.trim().toLowerCase()
  if (str === 'transparent') {
    return newColor(0, 0, 0, 0)
  }
  try {
    const hex = namedColorToHex(str)
    const triple = bedTriple(str)
    return parse(hex ? hex : triple ? `rgb(${triple})` : str)
  } catch {
    return undefined
  }
}

// Resolve a CSS color string to a Color: honors named colors, `transparent`,
// and bare BED color triples, and returns `fallback` on malformed-but-nonempty
// input. `parse` throws on e.g. an empty "rgb()"; callers pass a fallback so one
// bad per-feature color can't crash a whole render/RPC. An out-of-range triple
// is left to throw into `fallback` (magenta) rather than wrapping to a wrong
// color — the same rule featureItemRgb applies, so a jexl callback reading an
// itemRgb column and the automatic path agree on what counts as a color.
export function parseCssColorOr(color: string, fallback: Color): Color {
  return tryParseCssColor(color) ?? fallback
}

/**
 * Whether the painters read `color` as a color — a CSS name, hex, functional
 * form, `transparent` or a BED triple — rather than as the invalid sentinel.
 * What a `color` config slot admits.
 */
export function isCssColor(color: string) {
  return tryParseCssColor(color) !== undefined
}
