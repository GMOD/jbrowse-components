import {
  makeScoreNormalizer,
  scaleTypeCode,
} from '@jbrowse/render-core/scoreScale'
import { GLYPH_DISC } from '@jbrowse/render-core/shaders/pointMarkConsts'

import { categoricalScale } from '../ui/colors.ts'
import { categoricalField } from './categoricalField.ts'
import { cssColorToABGR, cssColorToRgba, packAbgr } from './colorBits.ts'
import { VIRIDIS_STOPS, buildColorRampLut } from './colorRamp.ts'
import { fieldReader } from './fieldReader.ts'
import Flatbush from './flatbush/index.ts'
import { GLYPH_CODES, GLYPH_NAMES } from './glyphNames.ts'
import { isJexl, stringToJexlExpression } from './jexlStrings.ts'
import { buildJexlContext } from './simpleFeature.ts'

import type { CategoricalField } from './categoricalField.ts'
import type { ColorRampStop } from './colorRamp.ts'
import type { JexlInstance } from './jexlStrings.ts'
import type {
  ColorEncoding,
  ColorScaleTable,
  Encoded,
  EncodedChannels,
  FieldRef,
  GlyphEncoding,
  GlyphName,
  GlyphScaleTable,
  LaneName,
  RampRef,
} from './markEncodingTypes.ts'
import type { ProgressReporter } from './progress.ts'
import type { Feature } from './simpleFeature.ts'

export type {
  AggregateOp,
  AggregateStep,
  BinStep,
  CategoricalRef,
  ColorEncoding,
  CoverageStep,
  ColorScaleTable,
  CoreEncodeFeaturesArgs,
  Encoded,
  EncodedChannels,
  EncodedFeaturesResult,
  FacetSection,
  FacetSpec,
  FieldRef,
  FilterStep,
  FormulaStep,
  GlyphEncoding,
  GlyphName,
  GlyphScaleTable,
  LaneName,
  LayerRequest,
  MarkEncoding,
  RampRef,
  ScaleTable,
  TransformStep,
} from './markEncodingTypes.ts'

export { NO_VALUE_LABEL } from './categoricalField.ts'

export const DEFAULT_MARK_COLOR = '#0068d1'

// What a feature paints when a `jexl:` colour yields a non-string or a ramp
// reads a value that is not finite: a misconfiguration, so it surfaces rather
// than vanishing, and darker than the no-category grey beside it.
const FALLBACK_COLOR = cssColorToABGR('#808080')

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
  row?: FieldRef | ChannelReader
  color?: ColorEncoding | ChannelReader<number>
  glyph?: GlyphEncoding | ChannelReader<number>
}

/**
 * #api
 * What surrounds an encode: the jexl instance a `jexl:` channel compiles
 * against — a caller whose channels are all readers or field names passes
 * none — and a progress reporter.
 */
export interface EncodeContext {
  jexl?: JexlInstance
  report?: ProgressReporter
}

function jexlExpression(ref: string, jexl: JexlInstance | undefined) {
  if (!jexl) {
    throw new Error(`a jexl: channel needs a jexl instance (${ref})`)
  }
  return stringToJexlExpression(ref, jexl)
}

function channelReader(
  ref: FieldRef | ChannelReader,
  jexl: JexlInstance | undefined,
): ChannelReader {
  return typeof ref === 'function' ? ref : fieldReader(ref, jexl)
}

function isGlyphName(glyph: string): glyph is GlyphName {
  return glyph in GLYPH_CODES
}

function glyphReader(
  glyph: Exclude<GlyphEncoding, object> | ChannelReader<number> | undefined,
  jexl: JexlInstance | undefined,
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
  const expr = jexlExpression(glyph, jexl)
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

// The categorical arm `color` and `glyph` share: the walk records which
// key each admitted instance carried, `''` for none, and `resolve` hands
// every key met its entry in the field's order, so two regions that met
// different key sets still agree on every key they share.
function categoricalChannel(
  read: ChannelReader,
  categories: CategoricalField,
  n: number,
) {
  const keys = new Map<string, number>()
  const indexOf = new Uint32Array(n)
  return {
    indexOf,
    collect(f: Feature, at: number) {
      const key = categories.key(read(f))
      let index = keys.get(key)
      if (index === undefined) {
        index = keys.size
        keys.set(key, index)
      }
      indexOf[at] = index
    },
    resolve<T>(entryOf: (key: string) => T) {
      const ofIndex: T[] = Array.from({ length: keys.size })
      const entries: { value: string; entry: T }[] = []
      for (const value of [...keys.keys()].sort(categories.compare)) {
        const entry = entryOf(value)
        ofIndex[keys.get(value)!] = entry
        entries.push({ value, entry })
      }
      return { ofIndex, entries }
    },
  }
}

/**
 * #api
 * The hit index over `count` instances: each a box from `x` to `x2` at its
 * `y`, or at 0 for a mark with no value.
 */
export function hitIndexOf(
  x: Uint32Array,
  x2: Uint32Array,
  y: Float32Array | undefined,
  count = x.length,
) {
  const fb = new Flatbush(count, undefined, Float64Array)
  for (let i = 0; i < count; i++) {
    const v = y ? y[i]! : 0
    fb.add(x[i]!, v, x2[i], v)
  }
  fb.finish()
  return fb
}

/**
 * #api
 * Evaluate one encoding over a feature list into dense channel arrays for
 * the lanes named, the scale table each scaled channel came from, the `y`
 * extremes and — when `index` is among the lanes — a hit index.
 *
 * A feature whose `x`, `x2` or (declared and asked-for) `y` is not finite is
 * skipped and counted in `skipped`, so every array stays index-aligned with
 * the Flatbush. Pure: the RPC around it owns the adapter, the filters and the
 * transferables.
 */
export function encodeFeatures<L extends LaneName>(
  features: readonly Feature[],
  encoding: MarkEncodingInput,
  lanes: readonly L[],
  ctx: EncodeContext = {},
): Encoded<L> {
  const { jexl, report } = ctx
  const n = features.length
  const has = (lane: LaneName) => (lanes as readonly LaneName[]).includes(lane)
  const readX = channelReader(encoding.x ?? 'start', jexl)
  const readX2 = channelReader(encoding.x2 ?? 'end', jexl)
  const { y: yEncoding } = encoding
  const readY =
    has('y') && yEncoding !== undefined
      ? channelReader(yEncoding, jexl)
      : undefined
  const readRow =
    has('row') && encoding.row !== undefined
      ? channelReader(encoding.row, jexl)
      : undefined

  const x = new Uint32Array(n)
  const x2 = new Uint32Array(n)
  const y = has('y') ? new Float32Array(n) : undefined
  const row = has('row') ? new Uint32Array(n) : undefined
  const glyph = has('glyph') ? new Uint8Array(n) : undefined
  const featureIndex = new Uint32Array(n)
  let yMin = Infinity
  let yMax = -Infinity
  let count = 0

  const colorEncoding = encoding.color ?? DEFAULT_MARK_COLOR
  const declaredScale =
    typeof colorEncoding === 'object' ? colorEncoding : undefined
  const rampEncoding =
    declaredScale && declaredScale.scale !== 'categorical'
      ? declaredScale
      : undefined
  // Which side of the wire a ramp resolves on is the caller's lane choice: a
  // shape that reads the ramp itself names `colorValue` and gets the raw
  // values, and the display unions the regions' extremes into one domain.
  // Anything else names `color` and the walk resolves per region.
  const colorValue =
    rampEncoding && has('colorValue') ? new Float32Array(n) : undefined
  const color = has('color') && !colorValue ? new Uint32Array(n) : undefined
  const wantColor = color !== undefined || colorValue !== undefined
  const scaled = wantColor ? declaredScale : undefined
  const readColor = !wantColor
    ? undefined
    : typeof colorEncoding === 'function'
      ? colorEncoding
      : scaled === undefined
        ? colorEvaluator(colorEncoding as string, jexl)
        : channelReader(scaled.field, jexl)
  // A scaled channel resolves after the walk, once the table is known: the
  // category per admitted instance, or a ramp's raw value, kept here.
  const colorField =
    scaled?.scale === 'categorical'
      ? categoricalField(scaled.field, {
          domain: scaled.domain?.map(String),
          palette: scaled.palette,
        })
      : undefined
  const colorCategories =
    colorField && readColor
      ? categoricalChannel(readColor, colorField, n)
      : undefined
  const rampValues =
    scaled && scaled.scale !== 'categorical'
      ? (colorValue ?? new Float32Array(n))
      : undefined
  const { glyph: glyphEncoding } = encoding
  const glyphScaled =
    glyph && typeof glyphEncoding === 'object' ? glyphEncoding : undefined
  const glyphField = glyphScaled
    ? categoricalField(glyphScaled.field, {
        domain: glyphScaled.domain?.map(String),
      })
    : undefined
  const glyphCategories =
    glyphScaled && glyphField
      ? categoricalChannel(
          channelReader(glyphScaled.field, jexl),
          glyphField,
          n,
        )
      : undefined
  const readGlyph = glyph
    ? glyphReader(
        typeof glyphEncoding === 'object' ? undefined : glyphEncoding,
        jexl,
      )
    : undefined

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
    if (y) {
      y[count] = yv
    }
    if (readY) {
      if (yv < yMin) {
        yMin = yv
      }
      if (yv > yMax) {
        yMax = yv
      }
    }
    if (row && readRow) {
      const rv = Number(readRow(f))
      row[count] = rv > 0 ? rv : 0
    }
    if (glyphCategories) {
      glyphCategories.collect(f, count)
    } else if (glyph && readGlyph) {
      glyph[count] = readGlyph(f)
    }
    featureIndex[count] = i
    if (colorCategories) {
      colorCategories.collect(f, count)
    } else if (rampValues && readColor) {
      rampValues[count] = Number(readColor(f))
    } else if (color && readColor) {
      color[count] = readColor(f) as number
    }
    count++
  }

  let scale: ColorScaleTable | undefined
  if (
    scaled?.scale === 'categorical' &&
    colorField &&
    colorCategories &&
    color
  ) {
    const { ofIndex, entries } = colorCategories.resolve(key =>
      cssColorToABGR(colorField.color(key)),
    )
    const { indexOf } = colorCategories
    for (let i = 0; i < count; i++) {
      color[i] = ofIndex[indexOf[i]!]!
    }
    scale = {
      kind: 'categorical',
      field: scaled.field,
      domain: [...colorField.domain],
      ...(scaled.palette ? { palette: [...scaled.palette] } : {}),
      ...(keysAreNumeric(entries) ? { numericKeys: true } : {}),
      entries: entries.map(e => ({ value: e.value, color: e.entry })),
    }
  } else if (scaled && scaled.scale !== 'categorical' && rampValues) {
    const extent = finiteExtremes(rampValues, count)
    const domain = scaled.domain ?? extent
    const lut = buildColorRampLut(rampStops(scaled.ramp))
    if (color) {
      const norm = makeScoreNormalizer(
        domain[0],
        domain[1],
        scaleTypeCode(scaled.scale),
        1,
      )
      for (let i = 0; i < count; i++) {
        const v = rampValues[i]!
        color[i] = Number.isFinite(v)
          ? lutColorAt(lut, norm(v))
          : FALLBACK_COLOR
      }
    }
    scale = {
      kind: 'ramp',
      field: scaled.field,
      scale: scaled.scale,
      domain,
      pinned: scaled.domain !== undefined,
      extent,
      lut,
    }
  }

  let glyphScale: GlyphScaleTable | undefined
  if (glyphScaled && glyphField && glyphCategories && glyph) {
    const glyphOf = categoricalScale(
      glyphField.domain,
      glyphScaled.range ?? GLYPH_NAMES,
    )
    const { ofIndex, entries } = glyphCategories.resolve((key): GlyphName =>
      key === '' ? 'disc' : glyphOf(key),
    )
    const codeOfIndex = Uint8Array.from(ofIndex, name => GLYPH_CODES[name])
    const { indexOf } = glyphCategories
    for (let i = 0; i < count; i++) {
      glyph[i] = codeOfIndex[indexOf[i]!]!
    }
    glyphScale = {
      kind: 'glyph',
      field: glyphScaled.field,
      domain: [...glyphField.domain],
      ...(glyphScaled.range ? { range: [...glyphScaled.range] } : {}),
      entries: entries.map(e => ({ value: e.value, glyph: e.entry })),
    }
  }

  const flatbushData =
    has('index') && count > 0 ? hitIndexOf(x, x2, y, count).data : undefined

  const encoded: EncodedChannels = {
    count,
    skipped: n - count,
    x: x.subarray(0, count),
    x2: x2.subarray(0, count),
    featureIndex: featureIndex.subarray(0, count),
    yMin,
    yMax,
  }
  if (y) {
    encoded.y = y.subarray(0, count)
  }
  if (row) {
    encoded.row = row.subarray(0, count)
  }
  if (color) {
    encoded.color = color.subarray(0, count)
  }
  if (colorValue) {
    encoded.colorValue = colorValue.subarray(0, count)
  }
  if (glyph) {
    encoded.glyph = glyph.subarray(0, count)
  }
  if (flatbushData) {
    encoded.flatbushData = flatbushData
  }
  if (scale) {
    encoded.scale = scale
  }
  if (glyphScale) {
    encoded.glyphScale = glyphScale
  }
  return encoded as Encoded<L>
}

function keysAreNumeric(entries: readonly { value: string }[]) {
  const named = entries.filter(e => e.value !== '')
  return named.length > 0 && named.every(e => Number.isFinite(Number(e.value)))
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
  jexl: JexlInstance | undefined,
): (feature: Feature) => number {
  if (isJexl(color)) {
    const expr = jexlExpression(color, jexl)
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
  const buffers: ArrayBufferLike[] = [
    c.x.buffer,
    c.x2.buffer,
    c.featureIndex.buffer,
  ]
  for (const lane of [c.y, c.row, c.color, c.colorValue, c.glyph]) {
    if (lane) {
      buffers.push(lane.buffer)
    }
  }
  if (c.flatbushData) {
    buffers.push(c.flatbushData)
  }
  return buffers
}
