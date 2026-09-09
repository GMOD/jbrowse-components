import { GLYPH_DISC } from '@jbrowse/render-core/shaders/pointMarkConsts'

import { categoricalPalette, categoricalValueColor } from '../ui/colors.ts'
import { cssColorToABGR, cssColorToRgba, packAbgr } from './colorBits.ts'
import { VIRIDIS_STOPS, buildColorRampLut } from './colorRamp.ts'
import Flatbush from './flatbush/index.ts'
import { GLYPH_CODES, GLYPH_NAMES } from './glyphNames.ts'
import { isJexl, stringToJexlExpression } from './jexlStrings.ts'
import { buildJexlContext } from './simpleFeature.ts'

import type { ColorRampStop } from './colorRamp.ts'
import type { JexlInstance } from './jexlStrings.ts'
import type {
  ColorEncoding,
  ColorScaleTable,
  EncodedChannels,
  FieldRef,
  GlyphEncoding,
  GlyphName,
  GlyphScaleTable,
  RampRef,
} from './markEncodingTypes.ts'
import type { ProgressReporter } from './progress.ts'
import type { Feature } from './simpleFeature.ts'

export type {
  CategoricalRef,
  ColorEncoding,
  ColorScaleTable,
  CoreEncodeFeaturesArgs,
  EncodedChannels,
  EncodedFeaturesResult,
  FieldRef,
  GlyphEncoding,
  GlyphName,
  GlyphScaleTable,
  MarkEncoding,
  RampRef,
  ScaleTable,
} from './markEncodingTypes.ts'

export const DEFAULT_MARK_COLOR = '#0068d1'

// What a feature paints when its colour field is missing or a `jexl:` colour
// yields a non-string: visible, so a misconfiguration surfaces rather than
// vanishing.
const FALLBACK_COLOR = cssColorToABGR('#808080')

/**
 * #api
 * The key row a feature with nothing in a categorical field lands on, so the
 * legend says why a mark is grey, or a disc, rather than listing a blank
 * value.
 */
export const NO_VALUE_LABEL = '(no value)'

/**
 * #api
 * A channel read per feature: the compiled form of a {@link FieldRef}, and
 * what a display's own worker method hands the encoder for a channel no
 * field name can say — a join against a second adapter, a lookup table, a
 * rule over two fields.
 */
export type ChannelReader<T = unknown> = (feature: Feature) => T

/**
 * #api
 * What `encodeFeatures` takes: a {@link MarkEncoding}, any channel of which
 * may be a {@link ChannelReader} in place of its declared form. The declared
 * form is what crosses the wire; a reader is built in the worker.
 */
export interface MarkEncodingInput {
  x?: FieldRef | ChannelReader
  x2?: FieldRef | ChannelReader
  y?: FieldRef | ChannelReader
  color?: ColorEncoding | ChannelReader<number>
  glyph?: GlyphEncoding | ChannelReader<number>
}

function fieldReader(
  ref: FieldRef | ChannelReader,
  jexl: JexlInstance,
): ChannelReader {
  if (typeof ref === 'function') {
    return ref
  }
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
  glyph: Exclude<GlyphEncoding, object> | ChannelReader<number> | undefined,
  jexl: JexlInstance,
): ChannelReader<number> {
  if (glyph === undefined) {
    return () => GLYPH_DISC
  }
  if (typeof glyph === 'function') {
    return glyph
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

// The categorical arm `color` and `glyph` share: the walk records which
// distinct value each admitted instance carried, and `resolve` hands every
// value its range entry once the region's table is known. A listed domain
// is the author's order and walks the range; without one the entry derives
// from the value itself, so two regions that met different value sets still
// agree on every value they share.
function categoricalChannel(read: ChannelReader, n: number) {
  const categories = new Map<string, number>()
  const indexOf = new Int32Array(n)
  return {
    indexOf,
    collect(f: Feature, at: number) {
      const raw = read(f)
      if (raw === undefined || raw === null || raw === '') {
        indexOf[at] = -1
        return
      }
      const label = String(raw)
      let index = categories.get(label)
      if (index === undefined) {
        index = categories.size
        categories.set(label, index)
      }
      indexOf[at] = index
    },
    resolve<T>(domain: (string | number)[] | undefined, range: readonly T[]) {
      const ofIndex: T[] = Array.from({ length: categories.size })
      const entries: { label: string; value: T }[] = []
      categoryOrder(categories, domain).forEach((label, slot) => {
        const value = domain
          ? range[slot % range.length]!
          : categoricalValueColor(label, range)
        const index = categories.get(label)
        if (index !== undefined) {
          ofIndex[index] = value
        }
        entries.push({ label, value })
      })
      return { ofIndex, entries }
    },
  }
}

function hasMissing(indexOf: Int32Array, count: number) {
  for (let i = 0; i < count; i++) {
    if (indexOf[i]! < 0) {
      return true
    }
  }
  return false
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
  encoding: MarkEncodingInput,
  ctx: { jexl: JexlInstance; report?: ProgressReporter },
): EncodedChannels {
  const { jexl, report } = ctx
  const n = features.length
  const readX = fieldReader(encoding.x ?? 'start', jexl)
  const readX2 = fieldReader(encoding.x2 ?? 'end', jexl)
  const readY =
    encoding.y === undefined ? undefined : fieldReader(encoding.y, jexl)

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
  const scaled = typeof colorEncoding === 'object' ? colorEncoding : undefined
  const readColor =
    typeof colorEncoding === 'function'
      ? colorEncoding
      : scaled === undefined
        ? colorEvaluator(colorEncoding as string, jexl)
        : fieldReader(scaled.field, jexl)
  // A scaled channel resolves after the walk, once the table is known: the
  // category per admitted instance, or a ramp's raw value, kept here.
  const colorCategories =
    scaled?.scale === 'categorical'
      ? categoricalChannel(readColor, n)
      : undefined
  const rampValues =
    scaled && scaled.scale !== 'categorical' ? new Float32Array(n) : undefined
  const { glyph: glyphEncoding } = encoding
  const glyphScaled =
    typeof glyphEncoding === 'object' ? glyphEncoding : undefined
  const glyphCategories = glyphScaled
    ? categoricalChannel(fieldReader(glyphScaled.field, jexl), n)
    : undefined
  const readGlyph = glyphReader(
    typeof glyphEncoding === 'object' ? undefined : glyphEncoding,
    jexl,
  )

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
    if (glyphCategories) {
      glyphCategories.collect(f, count)
    } else {
      glyph[count] = readGlyph(f)
    }
    featureIndex[count] = i
    if (colorCategories) {
      colorCategories.collect(f, count)
    } else if (rampValues) {
      rampValues[count] = Number(readColor(f))
    } else {
      color[count] = readColor(f) as number
    }
    count++
  }

  let scale: ColorScaleTable | undefined
  if (scaled?.scale === 'categorical' && colorCategories) {
    const palette = (scaled.palette ?? categoricalPalette).map(cssColorToABGR)
    const { ofIndex, entries } = colorCategories.resolve(scaled.domain, palette)
    const { indexOf } = colorCategories
    for (let i = 0; i < count; i++) {
      const index = indexOf[i]!
      color[i] = index < 0 ? FALLBACK_COLOR : ofIndex[index]!
    }
    scale = {
      kind: 'categorical',
      field: scaled.field,
      entries: [
        ...entries.map(e => ({ label: e.label, color: e.value })),
        ...(hasMissing(indexOf, count)
          ? [{ label: NO_VALUE_LABEL, color: FALLBACK_COLOR }]
          : []),
      ],
    }
  } else if (scaled && scaled.scale !== 'categorical' && rampValues) {
    const domain = scaled.domain ?? finiteExtremes(rampValues, count)
    const lut = buildColorRampLut(rampStops(scaled.ramp))
    const norm = normalizer(scaled.scale, domain)
    for (let i = 0; i < count; i++) {
      const v = rampValues[i]!
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

  let glyphScale: GlyphScaleTable | undefined
  if (glyphScaled && glyphCategories) {
    const { ofIndex, entries } = glyphCategories.resolve(
      glyphScaled.domain,
      glyphScaled.range ?? GLYPH_NAMES,
    )
    const codeOfIndex = Uint8Array.from(ofIndex, name => GLYPH_CODES[name])
    const { indexOf } = glyphCategories
    for (let i = 0; i < count; i++) {
      const index = indexOf[i]!
      glyph[i] = index < 0 ? GLYPH_DISC : codeOfIndex[index]!
    }
    glyphScale = {
      kind: 'glyph',
      field: glyphScaled.field,
      entries: [
        ...entries.map(e => ({ label: e.label, glyph: e.value })),
        ...(hasMissing(indexOf, count)
          ? [{ label: NO_VALUE_LABEL, glyph: 'disc' as const }]
          : []),
      ],
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
    glyphScale,
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
