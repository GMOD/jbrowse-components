import {
  MISCONFIGURED_ABGR,
  NO_VALUE_ABGR,
} from '@jbrowse/core/util/markEncoding'
import { SHAPE_CODES } from '@jbrowse/core/util/shapeNames'
import { touchesAny, windowsByRegion } from '@jbrowse/display-kit/keyWindows'
import { LINK_ELSEWHERE, LINK_NO_REGION } from '@jbrowse/render-core/marks'

import type { MarkRegionData, StoredLayer } from './markList.ts'
import type { KeyWindow } from '@jbrowse/display-kit/keyWindows'

type Spans = readonly { start: number; end: number }[]

const NO_SPANS: Spans = []

interface KeyLanes {
  x: Uint32Array
  x2: Uint32Array
  x2Region: Uint32Array | undefined
  color: Uint32Array | undefined
  glyph: Uint8Array | undefined
}

class KeyScan {
  readonly askedColors: ReadonlySet<number>
  readonly askedGlyphs: ReadonlySet<number>
  readonly colors = new Set<number>()
  readonly glyphs = new Set<number>()

  constructor(
    askedColors: ReadonlySet<number>,
    askedGlyphs: ReadonlySet<number>,
  ) {
    this.askedColors = askedColors
    this.askedGlyphs = askedGlyphs
  }

  get done() {
    return (
      this.colors.size === this.askedColors.size &&
      this.glyphs.size === this.askedGlyphs.size
    )
  }
}

// A chunk per call, as drawnScales scans: one long loop on-stack-replaced
// deopts at its exit on every call.
const SCAN_CHUNK = 4096

// An instance keys when its drawn extent touches a window: its span, or for
// a link whose far foot lies on another displayed region, either foot. A
// link another region draws keys there.
function scanChunk(
  scan: KeyScan,
  lanes: KeyLanes,
  spans: Spans,
  regionIndex: number,
  byRegion: ReadonlyMap<number, Spans>,
  from: number,
  to: number,
) {
  const { x, x2, x2Region, color, glyph } = lanes
  const { colors, glyphs, askedColors, askedGlyphs } = scan
  let lastColor = -1
  let lastGlyph = -1
  for (let i = from; i < to; i++) {
    const a = x[i]!
    const b = x2[i]!
    const lo = a < b ? a : b
    const hi = a < b ? b : a
    const far = x2Region ? x2Region[i]! : regionIndex
    const shown =
      far === regionIndex
        ? touchesAny(spans, lo, hi > lo ? hi : lo + 1)
        : far !== LINK_ELSEWHERE &&
          (touchesAny(spans, a, a + 1) ||
            (far !== LINK_NO_REGION &&
              touchesAny(byRegion.get(far) ?? NO_SPANS, b, b + 1)))
    if (shown) {
      if (color && color[i] !== lastColor) {
        lastColor = color[i]!
        if (askedColors.has(lastColor)) {
          colors.add(lastColor)
        }
      }
      if (glyph && glyph[i] !== lastGlyph) {
        lastGlyph = glyph[i]!
        if (askedGlyphs.has(lastGlyph)) {
          glyphs.add(lastGlyph)
        }
      }
    }
  }
}

/**
 * A layer's key rows over the instances on screen (ADR-093): a categorical or
 * identity color's entries, a threshold's or ramp's no-value and
 * not-a-number rows where the color lane paints them, and a shape's entries.
 * A hidden entry stays, the key being its way back. Ramp extents are not
 * narrowed, since the shaders paint through them. The scan stops once every
 * row it asks about is found.
 */
function layerKeyOnScreen(
  layer: StoredLayer,
  regionIndex: number,
  byRegion: ReadonlyMap<number, Spans>,
): StoredLayer {
  const { scale, shapeScale, color, glyph, count } = layer
  const colorLane =
    typeof color === 'object' && !layer.colorValue ? color : undefined
  const askedColors = new Set(
    !colorLane
      ? []
      : scale?.kind === 'categorical' || scale?.kind === 'identity'
        ? scale.entries.filter(e => !e.hidden).map(e => e.color)
        : scale?.kind === 'threshold' || scale?.kind === 'ramp'
          ? [
              ...(scale.missing ? [NO_VALUE_ABGR] : []),
              ...(scale.notNumber ? [MISCONFIGURED_ABGR] : []),
            ]
          : [],
  )
  const askedGlyphs = new Set(
    glyph && shapeScale
      ? shapeScale.entries.map(e => SHAPE_CODES[e.shape])
      : [],
  )
  if (askedColors.size === 0 && askedGlyphs.size === 0) {
    return layer
  }
  const scan = new KeyScan(askedColors, askedGlyphs)
  const lanes: KeyLanes = {
    x: layer.x,
    x2: layer.x2,
    x2Region: layer.x2Region,
    color: askedColors.size > 0 ? colorLane : undefined,
    glyph: askedGlyphs.size > 0 ? glyph : undefined,
  }
  const spans = byRegion.get(regionIndex) ?? NO_SPANS
  for (let from = 0; from < count && !scan.done; from += SCAN_CHUNK) {
    scanChunk(
      scan,
      lanes,
      spans,
      regionIndex,
      byRegion,
      from,
      Math.min(from + SCAN_CHUNK, count),
    )
  }
  const { colors, glyphs } = scan
  return {
    ...layer,
    scale:
      askedColors.size === 0
        ? scale
        : scale?.kind === 'categorical' || scale?.kind === 'identity'
          ? {
              ...scale,
              entries: scale.entries.filter(
                e => e.hidden || colors.has(e.color),
              ),
            }
          : scale?.kind === 'threshold' || scale?.kind === 'ramp'
            ? {
                ...scale,
                missing: scale.missing && colors.has(NO_VALUE_ABGR),
                notNumber: scale.notNumber && colors.has(MISCONFIGURED_ABGR),
              }
            : scale,
    shapeScale:
      askedGlyphs.size > 0 && shapeScale
        ? {
            ...shapeScale,
            entries: shapeScale.entries.filter(e =>
              glyphs.has(SHAPE_CODES[e.shape]),
            ),
          }
        : shapeScale,
  }
}

/** Each region's layers with their key rows over the instances on screen. */
export function regionsKeyOnScreen(
  regions: ReadonlyMap<number, MarkRegionData>,
  windows: readonly KeyWindow[],
) {
  const byRegion = windowsByRegion(windows)
  return [...regions].map(([regionIndex, region]) => ({
    ...region,
    layers: region.layers.map(layer =>
      layerKeyOnScreen(layer, regionIndex, byRegion),
    ),
  }))
}
