import { formatHEX, getAlpha, newColor, parseCssColorOr } from './colorBits.ts'

// Matches colord()'s fallback for unparseable input.
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
