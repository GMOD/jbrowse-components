import {
  GLYPH_DIAMOND,
  GLYPH_DISC,
  GLYPH_TRIANGLE,
} from '@jbrowse/render-core/shaders/pointMarkConsts'

import { categoricalPalette } from '../ui/colors.ts'
import { cssColorToABGR, cssColorToRgba, packAbgr } from './colorBits.ts'
import { VIRIDIS_STOPS, buildColorRampLut } from './colorRamp.ts'
import Flatbush from './flatbush/index.ts'
import { isJexl, stringToJexlExpression } from './jexlStrings.ts'
import { buildJexlContext } from './simpleFeature.ts'

import type { ColorRampStop } from './colorRamp.ts'
import type { JexlInstance } from './jexlStrings.ts'
import type {
  EncodedChannels,
  FieldRef,
  GlyphEncoding,
  GlyphName,
  MarkEncoding,
  RampRef,
  ScaleTable,
} from './markEncodingTypes.ts'
import type { ProgressReporter } from './progress.ts'
import type { Feature } from './simpleFeature.ts'

export type {
  ColorEncoding,
  CoreEncodeFeaturesArgs,
  EncodedChannels,
  EncodedFeaturesResult,
  FieldRef,
  GlyphEncoding,
  GlyphName,
  MarkEncoding,
  RampRef,
  ScaleTable,
} from './markEncodingTypes.ts'

export const DEFAULT_MARK_COLOR = '#0068d1'

// What a feature paints when its colour field is missing or a `jexl:` colour
// yields a non-string: visible, so a misconfiguration surfaces rather than
// vanishing.
const FALLBACK_COLOR = cssColorToABGR('#808080')

const GLYPH_CODES: Record<GlyphName, number> = {
  disc: GLYPH_DISC,
  triangle: GLYPH_TRIANGLE,
  diamond: GLYPH_DIAMOND,
}

function fieldReader(
  ref: FieldRef,
  jexl: JexlInstance,
): (feature: Feature) => unknown {
  if (isJexl(ref)) {
    const expr = stringToJexlExpression(ref, jexl)
    return feature => expr.eval(buildJexlContext({ feature }))
  }
  return feature => feature.get(ref)
}

function isGlyphName(glyph: string): glyph is GlyphName {
  return glyph in GLYPH_CODES
}

function glyphReader(
  glyph: GlyphEncoding | undefined,
  jexl: JexlInstance,
): (feature: Feature) => number {
  if (glyph === undefined) {
    return () => GLYPH_DISC
  }
  if (isGlyphName(glyph)) {
    const code = GLYPH_CODES[glyph]
    return () => code
  }
  const expr = stringToJexlExpression(glyph, jexl)
  return feature => {
    const v = expr.eval(buildJexlContext({ feature }))
    return typeof v === 'string' && isGlyphName(v) ? GLYPH_CODES[v] : GLYPH_DISC
  }
}

function rampStops(ramp: RampRef | undefined): readonly ColorRampStop[] {
  if (ramp === undefined || ramp === 'viridis') {
    return VIRIDIS_STOPS
  }
  return ramp.map(c => cssColorToRgba(c))
}

function lutColorAt(lut: Uint8Array, t: number) {
  const entries = lut.length / 4
  const i = Math.min(entries - 1, Math.max(0, Math.round(t * (entries - 1))))
  const o = i * 4
  return packAbgr(lut[o]!, lut[o + 1]!, lut[o + 2]!, lut[o + 3]!)
}

// The `[0, 1]` fraction a value sits at in the domain: the scale half of the
// y-channel split (ADR-097), spelled once here for colour. The log arm floors
// at the domain's own minimum so a domain below 1 still spreads.
function normalizer(scale: 'linear' | 'log', domain: [number, number]) {
  const [min, max] = domain
  if (scale === 'log') {
    const floorV = min > 0 ? min : 1
    const logMin = Math.log2(floorV)
    const logRange = Math.log2(Math.max(max, floorV)) - logMin
    return (v: number) =>
      logRange <= 0
        ? 0
        : Math.min(
            1,
            Math.max(0, (Math.log2(Math.max(v, floorV)) - logMin) / logRange),
          )
  }
  const range = max - min
  return (v: number) =>
    range <= 0 ? 0 : Math.min(1, Math.max(0, (v - min) / range))
}

function categoryOrder(
  seen: Map<string, number>,
  domain: (string | number)[] | undefined,
) {
  const listed = (domain ?? []).map(String)
  const rest = [...seen.keys()].filter(k => !listed.includes(k))
  const numeric = rest.every(k => k !== '' && Number.isFinite(Number(k)))
  rest.sort(
    numeric ? (a, b) => Number(a) - Number(b) : (a, b) => a.localeCompare(b),
  )
  return [...listed, ...rest]
}

/**
 * #api
 * Evaluate one encoding over a feature list into dense channel arrays, the
 * scale table its colours came from, the `y` extremes and a hit index.
 *
 * A feature whose `x`, `x2` or (declared) `y` is not finite is skipped, so
 * every array stays index-aligned with the Flatbush. Pure: the RPC around it
 * owns the adapter, the filters and the transferables.
 */
export function encodeFeatures(
  features: readonly Feature[],
  encoding: MarkEncoding,
  ctx: { jexl: JexlInstance; report?: ProgressReporter },
): EncodedChannels {
  const { jexl, report } = ctx
  const n = features.length
  const readX = fieldReader(encoding.x ?? 'start', jexl)
  const readX2 = fieldReader(encoding.x2 ?? 'end', jexl)
  const readY =
    encoding.y === undefined ? undefined : fieldReader(encoding.y, jexl)
  const readGlyph = glyphReader(encoding.glyph, jexl)

  const x = new Uint32Array(n)
  const x2 = new Uint32Array(n)
  const y = new Float32Array(n)
  const color = new Uint32Array(n)
  const glyph = new Uint8Array(n)
  const featureIndex = new Uint32Array(n)
  let yMin = Infinity
  let yMax = -Infinity
  let count = 0

  const colorEncoding = encoding.color ?? DEFAULT_MARK_COLOR
  const scaled = typeof colorEncoding === 'string' ? undefined : colorEncoding
  const readColor =
    scaled === undefined
      ? colorEvaluator(colorEncoding as string, jexl)
      : fieldReader(scaled.field, jexl)
  // A scaled colour resolves after the walk, once the table is known: the
  // category index or the raw value per admitted instance, kept here.
  const scaledValues = scaled ? new Float32Array(n) : undefined
  const categories =
    scaled?.scale === 'categorical' ? new Map<string, number>() : undefined

  for (let i = 0; i < n; i++) {
    report?.(i)
    const f = features[i]!
    const xv = Number(readX(f))
    const x2v = Number(readX2(f))
    const yv = readY ? Number(readY(f)) : 0
    if (!Number.isFinite(xv) || !Number.isFinite(x2v) || !Number.isFinite(yv)) {
      continue
    }
    x[count] = xv
    x2[count] = x2v
    y[count] = yv
    if (readY) {
      if (yv < yMin) {
        yMin = yv
      }
      if (yv > yMax) {
        yMax = yv
      }
    }
    glyph[count] = readGlyph(f)
    featureIndex[count] = i
    if (categories) {
      const raw = readColor(f)
      if (raw === undefined || raw === null || raw === '') {
        scaledValues![count] = -1
      } else {
        const label = String(raw)
        let index = categories.get(label)
        if (index === undefined) {
          index = categories.size
          categories.set(label, index)
        }
        scaledValues![count] = index
      }
    } else if (scaledValues) {
      scaledValues[count] = Number(readColor(f))
    } else {
      color[count] = readColor(f) as number
    }
    count++
  }

  let scale: ScaleTable | undefined
  if (scaled?.scale === 'categorical' && categories && scaledValues) {
    const order = categoryOrder(categories, scaled.domain)
    const palette = (scaled.palette ?? categoricalPalette).map(cssColorToABGR)
    const colorOfIndex = new Uint32Array(categories.size)
    const entries: { label: string; color: number }[] = []
    order.forEach((label, slot) => {
      const index = categories.get(label)
      const c = palette[slot % palette.length]!
      if (index !== undefined) {
        colorOfIndex[index] = c
      }
      entries.push({ label, color: c })
    })
    for (let i = 0; i < count; i++) {
      const index = scaledValues[i]!
      color[i] = index < 0 ? FALLBACK_COLOR : colorOfIndex[index]!
    }
    scale = { kind: 'categorical', field: scaled.field, entries }
  } else if (scaled && scaled.scale !== 'categorical' && scaledValues) {
    const domain = scaled.domain ?? finiteExtremes(scaledValues, count)
    const lut = buildColorRampLut(rampStops(scaled.ramp))
    const norm = normalizer(scaled.scale, domain)
    for (let i = 0; i < count; i++) {
      const v = scaledValues[i]!
      color[i] = Number.isFinite(v) ? lutColorAt(lut, norm(v)) : FALLBACK_COLOR
    }
    scale = {
      kind: 'ramp',
      field: scaled.field,
      scale: scaled.scale,
      domain,
      lut,
    }
  }

  let flatbushData: ArrayBuffer | undefined
  if (count > 0) {
    const fb = new Flatbush(count, undefined, Float64Array)
    for (let i = 0; i < count; i++) {
      const v = y[i]!
      fb.add(x[i]!, v, x2[i], v)
    }
    fb.finish()
    flatbushData = fb.data
  }

  return {
    count,
    x: x.subarray(0, count),
    x2: x2.subarray(0, count),
    y: y.subarray(0, count),
    color: color.subarray(0, count),
    glyph: glyph.subarray(0, count),
    featureIndex: featureIndex.subarray(0, count),
    yMin,
    yMax,
    flatbushData,
    scale,
  }
}

function finiteExtremes(values: Float32Array, count: number): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < count; i++) {
    const v = values[i]!
    if (Number.isFinite(v)) {
      if (v < min) {
        min = v
      }
      if (v > max) {
        max = v
      }
    }
  }
  return min === Infinity ? [0, 1] : [min, max]
}

/**
 * #api
 * A CSS colour or `jexl:` colour expression as a per-feature packed ABGR —
 * the unscaled arm of {@link ColorEncoding}, on its own for a display that
 * carries a plain `color` slot.
 */
export function colorEvaluator(
  color: string,
  jexl: JexlInstance,
): (feature: Feature) => number {
  if (isJexl(color)) {
    const expr = stringToJexlExpression(color, jexl)
    // A jexl colour answers from a handful of strings over a million
    // features; parsing each answer once is a third of the arm's cost
    // (packages/core/benches/encodeFeatures.bench.ts).
    const packed = new Map<string, number>()
    return feature => {
      const v = expr.eval(buildJexlContext({ feature }))
      if (typeof v !== 'string') {
        return FALLBACK_COLOR
      }
      let c = packed.get(v)
      if (c === undefined) {
        c = cssColorToABGR(v)
        packed.set(v, c)
      }
      return c
    }
  }
  const constant = cssColorToABGR(color)
  return () => constant
}

/**
 * #api
 * The buffers an {@link EncodedChannels} owns, for `rpcResult`'s transfer
 * list.
 */
export function encodedChannelTransferables(c: EncodedChannels) {
  return [
    c.x.buffer,
    c.x2.buffer,
    c.y.buffer,
    c.color.buffer,
    c.glyph.buffer,
    c.featureIndex.buffer,
    ...(c.flatbushData ? [c.flatbushData] : []),
  ]
}
