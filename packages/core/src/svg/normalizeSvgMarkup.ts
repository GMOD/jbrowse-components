import { splitPaintAlpha } from '../util/svgColorProps.ts'

// Coordinates computed as bp/bpPerPx land in attributes as long floats
// (`-32.4816`) or floating-point noise (`242.23839999999998`), bloating exports
// with sub-pixel precision no renderer needs. Round numbers inside a fixed
// whitelist of numeric attributes, so a track label or id that happens to look
// numeric is never a candidate for rewriting. Geometry gets 2 decimals
// (sub-pixel); opacity keeps 3 so a faint 0.01 mark can't collapse to 0.
const COORD_ATTRS = [
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'dx',
  'dy',
  'width',
  'height',
  'd',
  'points',
  'transform',
  'gradientTransform',
  'offset',
  'viewBox',
  'font-size',
  'stroke-width',
  'stroke-dashoffset',
  'stroke-dasharray',
]
const OPACITY_ATTRS = [
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'stop-opacity',
  'flood-opacity',
]

function makeRounder(attrs: string[], digits: number) {
  const re = new RegExp(`\\b(${attrs.join('|')})="([^"]*)"`, 'g')
  return (svg: string) =>
    svg.replaceAll(re, (_, name: string, value: string) => {
      const rounded = value.replaceAll(/-?\d+\.\d{3,}(?:e-?\d+)?/gi, n =>
        String(Number.parseFloat(Number(n).toFixed(digits))),
      )
      return `${name}="${rounded}"`
    })
}

const roundCoords = makeRounder(COORD_ATTRS, 2)
const roundOpacity = makeRounder(OPACITY_ATTRS, 3)

const OPACITY_OF: Record<string, string> = {
  fill: 'fill-opacity',
  stroke: 'stroke-opacity',
  'stop-color': 'stop-opacity',
  'flood-color': 'flood-opacity',
}
// a start tag, attribute by attribute, so a `>` inside a quoted value (which
// HTML serialization leaves unescaped) cannot end it early
const START_TAG = /<[a-zA-Z][^\s/>]*(?:\s+[^\s"'/=>]+="[^"]*")*\s*\/?>/g
const PAINT_ATTR = /\s(fill|stroke|stop-color|flood-color)="([^"]*)"/g
const MAY_NEED_SPLIT =
  /(?:fill|stroke|stop-color|flood-color)="(?:rgba|hsl|#[\da-f]{4}"|#[\da-f]{8}"|transparent)/i

// A JSX color reaches the file as React wrote it, and theme palette entries are
// routinely `rgba()` (`divider`, `text.secondary`) — see `splitPaintAlpha` for
// why that can't stay. Scoped to one start tag so an alpha folds into an
// opacity attribute the element already carries instead of duplicating it,
// which would not parse as XML.
function splitTagPaintAlpha(tag: string) {
  const alphas: [string, number][] = []
  let out = tag.replaceAll(PAINT_ATTR, (whole, name: string, value: string) => {
    const split = splitPaintAlpha(value)
    if (!split) {
      return whole
    }
    if (split.opacity < 1) {
      alphas.push([OPACITY_OF[name]!, split.opacity])
    }
    return ` ${name}="${split.color}"`
  })
  for (const [opacityName, alpha] of alphas) {
    const existing = new RegExp(`\\s${opacityName}="([^"]*)"`)
    out = existing.test(out)
      ? out.replace(
          existing,
          (_, v: string) => ` ${opacityName}="${Number(v) * alpha}"`,
        )
      : out.replace(/\s*(\/?>)$/, ` ${opacityName}="${alpha}"$1`)
  }
  return out
}

/**
 * The markup rules an SVG file has to meet that a React render into an HTML
 * container does not: XML entities only (HTML serialization writes U+00A0 as
 * `&nbsp;`, which XML does not define, so one no-break space in a feature label
 * made the whole file unparsable), SVG 1.1 colors, and rounded numbers.
 */
export function normalizeSvgMarkup(html: string) {
  const xml = html.replaceAll('&nbsp;', '&#160;')
  const split = MAY_NEED_SPLIT.test(xml)
    ? xml.replaceAll(START_TAG, splitTagPaintAlpha)
    : xml
  return roundOpacity(roundCoords(split))
}
