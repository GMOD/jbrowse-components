import {
  MISCONFIGURED_ABGR,
  NO_VALUE_ABGR,
  rampOverExtent,
} from '@jbrowse/core/util/markEncoding'
import { SHAPE_CODES } from '@jbrowse/core/util/shapeNames'
import { RAMP_NO_VALUE_BITS, rampValueBits } from '@jbrowse/render-core/marks'

import type { StoredLayer } from './markList.ts'

interface ScannedLanes {
  row: Uint32Array | undefined
  y: Float32Array | undefined
  color: Uint32Array | undefined
  glyph: Uint8Array | undefined
  size: Float32Array | undefined
  ramp: Float32Array | undefined
  rampBits: Uint32Array | undefined
}

class DrawnExtents {
  readonly askedColors: ReadonlySet<number>
  readonly askedGlyphs: ReadonlySet<number>
  readonly colors = new Set<number>()
  readonly glyphs = new Set<number>()
  yMin = Infinity
  yMax = -Infinity
  vMin = Infinity
  vMax = -Infinity
  sMin = Infinity
  sMax = -Infinity
  missing = false
  notNumber = false

  constructor(
    askedColors: ReadonlySet<number>,
    askedGlyphs: ReadonlySet<number>,
  ) {
    this.askedColors = askedColors
    this.askedGlyphs = askedGlyphs
  }
}

// A chunk per call: V8 compiles one long loop on-stack-replaced and keeps
// reusing that code, which deopts at the loop's exit on every call, twice the
// time at 500k instances.
const SCAN_CHUNK = 4096

function scanChunk(
  e: DrawnExtents,
  lanes: ScannedLanes,
  drawnKeys: Uint8Array | undefined,
  from: number,
  to: number,
) {
  const { row, y, color, glyph, size, ramp, rampBits } = lanes
  const { colors, glyphs, askedColors, askedGlyphs } = e
  let { yMin, yMax, vMin, vMax, sMin, sMax, missing, notNumber } = e
  let lastColor = -1
  let lastGlyph = -1
  for (let i = from; i < to; i++) {
    if (drawnKeys && drawnKeys[row ? row[i]! : 0] !== 1) {
      continue
    }
    if (color && colors.size < askedColors.size && color[i] !== lastColor) {
      lastColor = color[i]!
      if (askedColors.has(lastColor)) {
        colors.add(lastColor)
      }
    }
    if (glyph && glyphs.size < askedGlyphs.size && glyph[i] !== lastGlyph) {
      lastGlyph = glyph[i]!
      if (askedGlyphs.has(lastGlyph)) {
        glyphs.add(lastGlyph)
      }
    }
    if (y) {
      yMin = Math.min(yMin, y[i]!)
      yMax = Math.max(yMax, y[i]!)
    }
    if (size && Number.isFinite(size[i])) {
      sMin = Math.min(sMin, size[i]!)
      sMax = Math.max(sMax, size[i]!)
    }
    if (ramp) {
      const v = ramp[i]!
      if (Number.isFinite(v)) {
        vMin = Math.min(vMin, v)
        vMax = Math.max(vMax, v)
      } else if (Number.isNaN(v)) {
        if (rampBits?.[i] === RAMP_NO_VALUE_BITS) {
          missing = true
        } else {
          notNumber = true
        }
      }
    }
  }
  e.yMin = yMin
  e.yMax = yMax
  e.vMin = vMin
  e.vMax = vMax
  e.sMin = sMin
  e.sMax = sMax
  e.missing = missing
  e.notNumber = notNumber
}

/**
 * The key and the extents over the instances a layer draws, so a hidden
 * section or row leaves the legend and the axis the way it leaves the plot:
 * every instance, or with `drawnKeys` those whose `row` key it marks 1. The
 * lanes are the layer's own.
 */
export function drawnScales(
  layer: StoredLayer,
  drawnKeys?: Uint8Array,
): StoredLayer {
  const { count, color, colorValue, scale, shapeScale, sizeScale } = layer
  const ramp = scale?.kind === 'ramp' && colorValue ? colorValue : undefined
  const askedColors = new Set(
    !color || ramp
      ? []
      : scale?.kind === 'categorical'
        ? scale.entries.map(e => e.color)
        : scale?.kind === 'threshold' || scale?.kind === 'ramp'
          ? [NO_VALUE_ABGR, MISCONFIGURED_ABGR]
          : [],
  )
  const askedGlyphs = new Set(
    shapeScale?.entries.map(e => SHAPE_CODES[e.shape]) ?? [],
  )
  const lanes: ScannedLanes = {
    row: layer.row,
    y: layer.y,
    color: askedColors.size > 0 ? color : undefined,
    glyph: askedGlyphs.size > 0 ? layer.glyph : undefined,
    size: sizeScale && layer.size,
    ramp,
    rampBits: ramp && rampValueBits(ramp),
  }
  const extents = new DrawnExtents(askedColors, askedGlyphs)
  for (let from = 0; from < count; from += SCAN_CHUNK) {
    const to = Math.min(from + SCAN_CHUNK, count)
    scanChunk(extents, lanes, drawnKeys, from, to)
  }
  const {
    colors,
    glyphs,
    yMin,
    yMax,
    vMin,
    vMax,
    sMin,
    sMax,
    missing,
    notNumber,
  } = extents
  const valued = Number.isFinite(layer.yMin)
  return {
    ...layer,
    yMin: valued ? yMin : layer.yMin,
    yMax: valued ? yMax : layer.yMax,
    scale:
      scale?.kind === 'categorical' && color
        ? { ...scale, entries: scale.entries.filter(e => colors.has(e.color)) }
        : ramp && scale?.kind === 'ramp'
          ? {
              ...(scale.pinned[0] && scale.pinned[1]
                ? { ...scale, extent: [vMin, vMax] as [number, number] }
                : rampOverExtent(scale, [vMin, vMax])),
              missing,
              notNumber,
            }
          : (scale?.kind === 'threshold' || scale?.kind === 'ramp') && color
            ? {
                ...scale,
                missing: scale.missing && colors.has(NO_VALUE_ABGR),
                notNumber: scale.notNumber && colors.has(MISCONFIGURED_ABGR),
              }
            : scale,
    shapeScale: shapeScale && {
      ...shapeScale,
      entries: shapeScale.entries.filter(e => glyphs.has(SHAPE_CODES[e.shape])),
    },
    sizeScale: sizeScale && { ...sizeScale, extent: [sMin, sMax] },
  }
}
