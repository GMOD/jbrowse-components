// The color math is `ui/palette.ts`'s, not Material UI's. Same values —
// `palette.test.ts` asserts them against a real MUI theme, and `emphasize` is
// checked against MUI's directly below — but this module is reached from a
// plugin's eagerly-evaluated code, and the MUI import made it one of the
// first-party edges keeping `@mui/material/styles` in every host's first paint.
// See agent-docs/reference/EAGER_BUNDLE.md.
import {
  darken,
  getContrastRatio,
  lighten,
  getLuminance as luminanceOf,
} from '../../ui/palette.ts'
import * as convert from '../color-bits/convert.ts'
import { cssColorToNormalizedRgb } from '../colorBits.ts'
import { namedColorToHex } from './cssColorsLevel4.ts'

/**
 * The relative brightness of any point in a color space,
 * normalized to 0 for darkest black and 1 for lightest white,
 * with support for named colors on top.
 *
 * Formula: https://www.w3.org/TR/WCAG20-TECHS/G17.html#G17-tests
 *
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(),
 *  hsl(), hsla(), or named color
 * @returns The relative brightness of the color in the range 0 - 1
 */
function getLuminance(color: string): number {
  const convertedColor = namedColorToHex(color)
  return luminanceOf(convertedColor || color)
}

/**
 * Darken or lighten a color, depending on its luminance.
 * Light colors are darkened, dark colors are lightened.
 *
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(),
 * hsl(), hsla(), or named color
 * @param coefficient - multiplier in the range 0 - 1, defaults to 0.15
 * @returns A CSS color string. Hex input values are returned as rgb
 */
export function emphasize(color: string, coefficient = 0.15): string {
  const convertedColor = namedColorToHex(color) || color
  return getLuminance(convertedColor) > 0.5
    ? darken(convertedColor, coefficient)
    : lighten(convertedColor, coefficient)
}

const CONTRAST_STEPS = 20

/**
 * Push `foreground` away from `background` until it clears `minContrastRatio`,
 * returning the closest it got when that ratio is unreachable.
 *
 * `minContrastRatio` genuinely cannot be met against a mid-luminance
 * background: lighten/darken clamp their coefficient at 1, so the candidate
 * pins at white/black, and against a `#b0b0b0` paper the best ratio any color
 * reaches is about 2.2. This used to be a `while (ratio < min)` loop with an
 * unbounded coefficient, which froze the render thread outright for 38 of the 40
 * default refName colors.
 */
export function makeContrasting(
  foreground: string,
  background = 'white',
  minContrastRatio = 3,
) {
  const originalColor = namedColorToHex(foreground) || foreground
  const convertedBackground = namedColorToHex(background) || background
  const backgroundLuminance = getLuminance(convertedBackground)
  let best = originalColor
  let bestRatio = getContrastRatio(originalColor, convertedBackground)
  // an integer step keeps the last coefficient exactly 1, where the clamp bites
  for (
    let step = 1;
    step <= CONTRAST_STEPS && bestRatio < minContrastRatio;
    step++
  ) {
    const coefficient = step / CONTRAST_STEPS
    const candidate =
      backgroundLuminance > 0.5
        ? darken(originalColor, coefficient)
        : lighten(originalColor, coefficient)
    const ratio = getContrastRatio(candidate, convertedBackground)
    // lightening a dark color against a mid-grey background dips before it
    // climbs, so track the max rather than taking the last candidate
    if (ratio > bestRatio) {
      best = candidate
      bestRatio = ratio
    }
  }
  return best
}

export { isNamedColor, namedColorToHex } from './cssColorsLevel4.ts'

// The (lightness, chroma) tiers randomColor picks between, in OKLCH. Values are
// in the band a hand-built categorical palette occupies — bright enough to tell
// apart, dark enough that black text over one still reads, and never near
// white/black. The three differ enough to separate two neighbouring hues, and
// little enough that no tier reads as "the faded ones".
const RANDOM_COLOR_TIERS = [
  { lightness: 0.66, chroma: 0.15 },
  { lightness: 0.56, chroma: 0.14 },
  { lightness: 0.75, chroma: 0.12 },
]

// sRGB has room for very different amounts of chroma at different hues (a
// vivid yellow exists, an equally vivid blue does not), so a requested chroma
// is often outside the gamut. Bisect down to the most saturated in-gamut
// version of the SAME hue and lightness, rather than letting the channel clamp
// do it — clamping a channel shifts the hue, which is the one thing this must
// hold constant.
const GAMUT_BISECTION_STEPS = 8
const GAMUT_EPSILON = 1 / 512

function oklchToSrgb(lightness: number, chroma: number, hue: number) {
  return convert.xyzd50ToSrgb(...convert.oklchToXyzd50(lightness, chroma, hue))
}

function inGamut(rgb: [number, number, number]) {
  return rgb.every(v => v >= -GAMUT_EPSILON && v <= 1 + GAMUT_EPSILON)
}

function oklchToHex(lightness: number, chroma: number, hue: number) {
  let rgb = oklchToSrgb(lightness, chroma, hue)
  if (!inGamut(rgb)) {
    let lo = 0
    let hi = chroma
    for (let i = 0; i < GAMUT_BISECTION_STEPS; i++) {
      const mid = (lo + hi) / 2
      const candidate = oklchToSrgb(lightness, mid, hue)
      if (inGamut(candidate)) {
        lo = mid
        rgb = candidate
      } else {
        hi = mid
      }
    }
  }
  return `#${rgb
    .map(v =>
      Math.max(0, Math.min(255, Math.round(v * 255)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

/**
 * #api
 * Move a color's OKLCH lightness by `lightnessShift` and scale its chroma,
 * holding its hue.
 *
 * For extending a categorical palette past its length. Cycling a nine-color
 * list over a 24-chromosome karyotype repeats the color outright; cycling it
 * with a lightness shift per lap gives the hue back as a variant still told
 * apart from the original — tab20's construction, which pairs a light and a
 * dark of each hue.
 *
 * SHIFT rather than a fixed lightness, and SCALE rather than a fixed chroma,
 * because a categorical palette is uneven on purpose: category10's brown and
 * its red are 5 degrees apart in hue and are told apart by chroma alone, so
 * re-lighting both to one (lightness, chroma) makes them the same color.
 * Keeping each color's own relative chroma keeps brown reading as brown.
 *
 * In OKLCH rather than through `lighten`/`darken`, which work in sRGB, where
 * the same coefficient moves a yellow and a blue by visibly different amounts:
 * a lap has to read as one tone across the whole palette or it reads as noise.
 *
 * @param color - CSS color to transform
 * @param lightnessShift - added to its OKLCH lightness (which is 0 - 1)
 * @param chromaScale - multiplies its OKLCH chroma; the result is reduced at
 *  constant hue if that lands out of gamut
 * @returns A CSS hex color string
 */
export function relight(
  color: string,
  lightnessShift: number,
  chromaScale = 1,
) {
  const [lightness, chroma, hue] = convert.xyzd50ToOklch(
    ...convert.srgbToXyzd50(...cssColorToNormalizedRgb(color)),
  )
  return oklchToHex(
    Math.max(0, Math.min(1, lightness + lightnessShift)),
    chroma * chromaScale,
    hue,
  )
}

/**
 * Generate a consistent random color for a given string.
 * The same string will always generate the same color, with no shared palette
 * state — so the same value (e.g. a gene symbol used as an ortholog id) gets the
 * same color across independent tracks/panels.
 *
 * Statelessness is why this hashes into a color space rather than indexing a
 * fixed palette of N: with no allocator there is no "next unused color", so an
 * N-color palette collides by the birthday problem — six values into a
 * twenty-color palette collide more often than not — while a hue circle does
 * not repeat until 360 values. What a curated palette actually buys is
 * perceptual evenness, and that comes from the space, not the list: hues are
 * placed in OKLCH at a fixed lightness and chroma, so every value is equally
 * light and equally colorful. HSL, which this used to use, is neither — its
 * hue wheel spends a quarter of itself on greens that look identical and a
 * sliver on yellow, and at one lightness its yellows glare while its blues go
 * murky. That unevenness is what reads as "random RGB".
 *
 * @param str - The string to generate a color from
 * @returns A CSS hex color string
 */
export function randomColor(str: string): string {
  // djb2 hash — much better distribution than a char-code sum (anagrams and
  // similar strings get well-separated hues).
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  const h = hash >>> 0
  const hue = h % 360
  // The tier is picked by a separately mixed hash (xorshift + Math.imul for a
  // real 32-bit multiply — a plain `*` overflows float precision and drops the
  // low bits) so it varies independently of the hue rather than tracking it.
  const mix = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
  const tier = RANDOM_COLOR_TIERS[mix % RANDOM_COLOR_TIERS.length]!
  return oklchToHex(tier.lightness, tier.chroma, hue)
}
