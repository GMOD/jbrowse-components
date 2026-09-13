import {
  formatHEX,
  getAlpha,
  getBlue,
  getGreen,
  getRed,
  newColor,
  parseCssColorOr,
} from './colorBits.ts'

// Matches colord()'s fallback for unparsable input.
const FALLBACK = newColor(0, 0, 0, 255)

// Works on the packed Color directly rather than via colord(): these run per
// path per render on overlay tracks, and each colord() allocates an object
// carrying nine closures — two of them, since .alpha(1) builds another. formatHEX
// ignores the alpha byte, so stripping alpha before formatting was a no-op.
export function stripAlpha(str: string) {
  return formatHEX(parseCssColorOr(str, FALLBACK))
}

function svgColorProps(str: string, colorKey: string, opacityKey: string) {
  if (str) {
    const c = parseCssColorOr(str, FALLBACK)
    return {
      [opacityKey]: getAlpha(c) / 255,
      [colorKey]: formatHEX(c),
    }
  } else {
    return {}
  }
}

export function getStrokeProps(str: string) {
  return svgColorProps(str, 'stroke', 'strokeOpacity')
}

export function getFillProps(str: string) {
  return svgColorProps(str, 'fill', 'fillOpacity')
}

// four channels, comma- or slash-separated, so a three-channel `rgb(4,5,6)`
// never reads its blue as an alpha
const FUNCTIONAL_ALPHA =
  /^(?:rgb|hsl)a?\((?:[^,/)]+,){3}\s*([\d.]+)(%?)\s*\)$|^(?:rgb|hsl)a?\([^,/)]+\/\s*([\d.]+)(%?)\s*\)$/i
const HEX_ALPHA = /^#(?:[\da-f]{4}|[\da-f]{8})$/i
const NOT_SVG_COLOR = /^(?:rgba|hsla?)\(|^transparent$/i

/**
 * A paint value split into the `rgb()` an SVG 1.1 `<color>` can carry and the
 * alpha it cannot, for a separate `*-opacity`. Illustrator and older Inkscape
 * drop an element whose fill they cannot parse, so `rgba()`, `hsl()`, `#rgba`
 * and `transparent` have to be split before they reach a file. Undefined for a
 * value that is already an SVG color, `none` or a `url()`.
 */
export function splitPaintAlpha(value: string) {
  const m = FUNCTIONAL_ALPHA.exec(value)
  if (!m && !HEX_ALPHA.test(value) && !NOT_SVG_COLOR.test(value)) {
    return undefined
  }
  const c = parseCssColorOr(value, FALLBACK)
  const digits = m?.[1] ?? m?.[3]
  const percent = (m?.[2] ?? m?.[4]) === '%'
  return {
    color: `rgb(${getRed(c)},${getGreen(c)},${getBlue(c)})`,
    opacity:
      digits === undefined
        ? getAlpha(c) / 255
        : Math.min(1, Number(digits) / (percent ? 100 : 1)),
  }
}
