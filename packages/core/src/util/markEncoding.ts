import {
  makeScoreNormalizer,
  scaleTypeCode,
} from '@jbrowse/render-core/scoreScale'
import { RAMP_NO_VALUE_BITS } from '@jbrowse/render-core/shaders/markColorConsts'
import { GLYPH_DISC } from '@jbrowse/render-core/shaders/pointMarkConsts'

import { categoricalScale } from '../ui/colors.ts'
import { categoricalField } from './categoricalField.ts'
import { MISCONFIGURED_COLOR, NO_CATEGORY_COLOR } from './color/index.ts'
import { cssColorToABGR, packAbgr } from './colorBits.ts'
import { buildColorRampLut, colorRampStops, rampDomain } from './colorRamp.ts'
import { fieldReader } from './fieldReader.ts'
import Flatbush from './flatbush/index.ts'
import { valueText } from './groupKeys.ts'
import { isJexl, stringToJexlExpression } from './jexlStrings.ts'
import { numericValue } from './numericValue.ts'
import { SHAPE_CODES, SHAPE_NAMES } from './shapeNames.ts'
import { buildJexlContext } from './simpleFeature.ts'
import {
  isMissing,
  thresholdCuts,
  thresholdIndex,
  thresholdPalette,
} from './thresholdScale.ts'

import type { CategoricalField } from './categoricalField.ts'
import type { ColorRampStop } from './colorRamp.ts'
import type { JexlInstance } from './jexlStrings.ts'
import type {
  ColorEncoding,
  ColorScaleTable,
  ContinuousRef,
  Encoded,
  EncodedChannels,
  FieldRef,
  LocusRef,
  ShapeEncoding,
  ShapeName,
  ShapeScaleTable,
  SizeEncoding,
  SizeRef,
  SizeScaleTable,
  LaneName,
} from './markEncodingTypes.ts'
import type { ProgressReporter } from './progress.ts'
import type { Feature } from './simpleFeature.ts'

export type {
  AggregateOp,
  AggregateStep,
  BinStep,
  CategoricalRef,
  ColorEncoding,
  ContinuousRef,
  CoverageStep,
  ColorScaleTable,
  CoreGetEncodedLayersArgs,
  Encoded,
  EncodedChannels,
  EncodedLayersResult,
  FacetSection,
  FacetSpec,
  FieldRef,
  FilterStep,
  FormulaStep,
  LocusRef,
  MateStep,
  ShapeEncoding,
  ShapeName,
  ShapeScaleTable,
  SizeEncoding,
  SizeRef,
  SizeScaleTable,
  LaneName,
  LayerRequest,
  MarkEncoding,
  ScaleTable,
  ThresholdRef,
  TransformStep,
} from './markEncodingTypes.ts'
export type { ColorSchemeName } from './colorSchemes.ts'
export { COLOR_SCHEMES } from './colorSchemes.ts'

export { NO_VALUE_LABEL } from './categoricalField.ts'

export const DEFAULT_MARK_COLOR = '#0068d1'

export const DEFAULT_SIZE_RANGE_PX: [number, number] = [1, 6]

/**
 * #api
 * The misconfiguration grey packed as the encoder paints it: a `jexl:` colour
 * that answered no string, a ramp value that is no number, text a threshold
 * cannot read.
 */
export const MISCONFIGURED_ABGR = cssColorToABGR(MISCONFIGURED_COLOR)

/**
 * #api
 * The no-value grey packed as the encoder paints it: a feature with nothing in
 * the field a threshold reads.
 */
export const NO_VALUE_ABGR = cssColorToABGR(NO_CATEGORY_COLOR)

const FALLBACK_COLOR = MISCONFIGURED_ABGR

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
 * may be a {@link ChannelReader} in place of its declared form, and `row` the
 * values themselves, one per input feature, where the caller computed them —
 * a facet's stacked rows. The declared form is what crosses the wire; a
 * reader or a value list is built in the worker.
 */
export interface MarkEncodingInput {
  x?: FieldRef | ChannelReader
  x2?: FieldRef | LocusRef | ChannelReader
  y?: FieldRef | ChannelReader
  row?: FieldRef | ChannelReader | ArrayLike<number>
  color?: ColorEncoding | ChannelReader<number>
  shape?: ShapeEncoding | ChannelReader<number>
  text?: FieldRef | ChannelReader
  size?: SizeEncoding
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

function isShapeName(shape: string): shape is ShapeName {
  return shape in SHAPE_CODES
}

function shapeReader(
  shape: Exclude<ShapeEncoding, object> | ChannelReader<number> | undefined,
  jexl: JexlInstance | undefined,
): ChannelReader<number> {
  if (shape === undefined) {
    return () => GLYPH_DISC
  }
  if (typeof shape === 'function') {
    return shape
  }
  if (isShapeName(shape)) {
    const code = SHAPE_CODES[shape]
    return () => code
  }
  const expr = jexlExpression(shape, jexl)
  return feature => {
    const v = expr.eval(buildJexlContext({ feature }))
    return typeof v === 'string' && isShapeName(v) ? SHAPE_CODES[v] : GLYPH_DISC
  }
}

function lutColorAt(lut: Uint8Array, t: number) {
  const entries = lut.length / 4
  const i = Math.min(entries - 1, Math.max(0, Math.round(t * (entries - 1))))
  const o = i * 4
  return packAbgr(lut[o]!, lut[o + 1]!, lut[o + 2]!, lut[o + 3]!)
}

// The categorical arm `color` and `shape` share: the walk records which
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
    const a = x[i]!
    const b = x2[i]!
    fb.add(Math.min(a, b), v, Math.max(a, b), v)
  }
  fb.finish()
  return fb
}

/**
 * #api
 * An encoded payload as a display stores it: the hit index the worker built
 * with {@link hitIndexOf}, wrapped once where the payload lands.
 */
export type HitIndexed<T extends EncodedChannels> = T & { flatbush?: Flatbush }

/**
 * #api
 * {@link HitIndexed} over what the worker shipped.
 */
export function withHitIndex<T extends EncodedChannels>(
  channels: T,
): HitIndexed<T> {
  const { flatbushData } = channels
  return {
    ...channels,
    flatbush: flatbushData ? Flatbush.from(flatbushData) : undefined,
  }
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
  const { x2: x2Encoding } = encoding
  const x2Locus = typeof x2Encoding === 'object' ? x2Encoding : undefined
  const readX2 = channelReader(
    typeof x2Encoding === 'object' ? x2Encoding.pos : (x2Encoding ?? 'end'),
    jexl,
  )
  const readX2Chrom = x2Locus ? channelReader(x2Locus.chrom, jexl) : undefined
  const x2Ref = has('x2Ref') ? new Uint32Array(n) : undefined
  const x2RefNames: string[] = []
  const refIndex = new Map<string, number>()
  const { size: sizeEncoding } = encoding
  const sizeRef: SizeRef | undefined =
    has('size') &&
    sizeEncoding !== undefined &&
    typeof sizeEncoding !== 'number'
      ? typeof sizeEncoding === 'string'
        ? { field: sizeEncoding }
        : sizeEncoding
      : undefined
  const size = sizeRef ? new Float32Array(n) : undefined
  const readSize = sizeRef ? channelReader(sizeRef.field, jexl) : undefined
  const { y: yEncoding } = encoding
  const readY =
    has('y') && yEncoding !== undefined
      ? channelReader(yEncoding, jexl)
      : undefined
  const { row: rowEncoding } = encoding
  const rowValues =
    has('row') && typeof rowEncoding === 'object' ? rowEncoding : undefined
  const readRow =
    has('row') && rowEncoding !== undefined && typeof rowEncoding !== 'object'
      ? channelReader(rowEncoding, jexl)
      : undefined

  const { text: textEncoding } = encoding
  const readText =
    has('text') && textEncoding !== undefined
      ? channelReader(textEncoding, jexl)
      : undefined

  const x = new Uint32Array(n)
  const x2 = new Uint32Array(n)
  const y = has('y') ? new Float32Array(n) : undefined
  const row = has('row') ? new Uint32Array(n) : undefined
  const glyph = has('glyph') ? new Uint8Array(n) : undefined
  const text = has('text') ? new Array<string>(n) : undefined
  const featureIndex = new Uint32Array(n)
  let yMin = Infinity
  let yMax = -Infinity
  let count = 0
  let skippedPosition = 0

  const colorEncoding = encoding.color ?? DEFAULT_MARK_COLOR
  const declaredScale =
    typeof colorEncoding === 'object' ? colorEncoding : undefined
  const rampEncoding =
    declaredScale &&
    (declaredScale.scale === 'linear' || declaredScale.scale === 'log')
      ? declaredScale
      : undefined
  // Which side of the wire a ramp resolves on is the caller's lane choice: a
  // mark that reads the ramp itself names `colorValue` and gets the raw
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
          range: scaled.range,
        })
      : undefined
  const colorCategories =
    colorField && readColor
      ? categoricalChannel(readColor, colorField, n)
      : undefined
  const rampValues =
    scaled && rampEncoding ? (colorValue ?? new Float32Array(n)) : undefined
  const rampBits = rampValues
    ? new Uint32Array(rampValues.buffer, rampValues.byteOffset, n)
    : undefined
  const thresholdEncoding = scaled?.scale === 'threshold' ? scaled : undefined
  const cuts = thresholdEncoding
    ? thresholdCuts(thresholdEncoding.domain ?? [])
    : undefined
  const binColors =
    thresholdEncoding && cuts
      ? Uint32Array.from(
          thresholdPalette(cuts.length + 1, thresholdEncoding.range),
          c => cssColorToABGR(c),
        )
      : undefined
  let missingMet = false
  let notNumberMet = false
  const { shape: shapeEncoding } = encoding
  const shapeScaled =
    glyph && typeof shapeEncoding === 'object' ? shapeEncoding : undefined
  const shapeField = shapeScaled
    ? categoricalField(shapeScaled.field, {
        domain: shapeScaled.domain?.map(String),
      })
    : undefined
  const shapeCategories =
    shapeScaled && shapeField
      ? categoricalChannel(
          channelReader(shapeScaled.field, jexl),
          shapeField,
          n,
        )
      : undefined
  const readShape = glyph
    ? shapeReader(
        typeof shapeEncoding === 'object' ? undefined : shapeEncoding,
        jexl,
      )
    : undefined

  for (let i = 0; i < n; i++) {
    report?.(i)
    const f = features[i]!
    const xv = numericValue(readX(f))
    const x2v = numericValue(readX2(f))
    const yv = readY ? numericValue(readY(f)) : 0
    if (!Number.isFinite(xv) || !Number.isFinite(x2v) || !Number.isFinite(yv)) {
      if (!Number.isFinite(xv) || !Number.isFinite(x2v)) {
        skippedPosition++
      }
      continue
    }
    x[count] = xv
    x2[count] = x2v
    if (x2Ref) {
      const there = readX2Chrom ? valueText(readX2Chrom(f)) : f.get('refName')
      let ref = refIndex.get(there)
      if (ref === undefined) {
        ref = x2RefNames.length
        refIndex.set(there, ref)
        x2RefNames.push(there)
      }
      x2Ref[count] = ref
    }
    if (y) {
      y[count] = yv
    }
    if (size && readSize) {
      size[count] = numericValue(readSize(f))
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
    } else if (row && rowValues) {
      const rv = rowValues[i]!
      row[count] = rv > 0 ? rv : 0
    }
    if (shapeCategories) {
      shapeCategories.collect(f, count)
    } else if (glyph && readShape) {
      glyph[count] = readShape(f)
    }
    if (text) {
      text[count] = readText ? valueText(readText(f)) : ''
    }
    featureIndex[count] = i
    if (colorCategories) {
      colorCategories.collect(f, count)
    } else if (rampValues && rampBits && readColor) {
      const v = readColor(f)
      if (isMissing(v)) {
        rampBits[count] = RAMP_NO_VALUE_BITS
        missingMet = true
      } else {
        rampValues[count] = numericValue(v)
        notNumberMet ||= Number.isNaN(rampValues[count])
      }
    } else if (binColors && cuts && color && readColor) {
      const v = readColor(f)
      const bin = thresholdIndex(v, cuts)
      if (bin >= 0) {
        color[count] = binColors[bin]!
      } else if (isMissing(v)) {
        color[count] = NO_VALUE_ABGR
        missingMet = true
      } else {
        color[count] = FALLBACK_COLOR
        notNumberMet = true
      }
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
      ...(scaled.range ? { range: [...scaled.range] } : {}),
      ...(scaled.labels?.length ? { labels: [...scaled.labels] } : {}),
      ...(keysAreNumeric(entries) ? { numericKeys: true } : {}),
      entries: entries.map(e => ({ value: e.value, color: e.entry })),
    }
  } else if (thresholdEncoding && cuts && binColors) {
    scale = {
      kind: 'threshold',
      field: thresholdEncoding.field,
      domain: cuts,
      ...(thresholdEncoding.range
        ? { range: [...thresholdEncoding.range] }
        : {}),
      ...(thresholdEncoding.labels?.length
        ? { labels: [...thresholdEncoding.labels] }
        : {}),
      ...(missingMet ? { missing: true } : {}),
      ...(notNumberMet ? { notNumber: true } : {}),
    }
  } else if (rampEncoding && rampValues) {
    const extent = finiteExtremes(rampValues, count)
    const { domainMin, domainMax, domainMid, range, scheme, reverse } =
      rampEncoding
    const { domain, stops, lut, colorOf } = continuousColorScale(
      rampEncoding,
      extent,
    )
    if (color && rampBits) {
      for (let i = 0; i < count; i++) {
        color[i] =
          rampBits[i] === RAMP_NO_VALUE_BITS
            ? NO_VALUE_ABGR
            : colorOf(rampValues[i]!)
      }
    }
    scale = {
      kind: 'ramp',
      field: rampEncoding.field,
      scale: rampEncoding.scale,
      domain,
      pinned: [domainMin !== undefined, domainMax !== undefined],
      ...(domainMid === undefined ? {} : { domainMid, stops }),
      ...(range ? { range: [...range] } : {}),
      ...(scheme ? { scheme } : {}),
      ...(reverse ? { reverse } : {}),
      extent,
      lut,
      ...(missingMet ? { missing: true } : {}),
      ...(notNumberMet ? { notNumber: true } : {}),
    }
  }

  let shapeScale: ShapeScaleTable | undefined
  if (shapeScaled && shapeField && shapeCategories && glyph) {
    const range = shapeScaled.range ?? SHAPE_NAMES
    const shapeOf = categoricalScale(shapeField.domain, range, {
      fallback: range.length > shapeField.domain.length ? [] : SHAPE_NAMES,
    })
    const { ofIndex, entries } = shapeCategories.resolve((key): ShapeName =>
      key === '' ? 'circle' : shapeOf(key),
    )
    const codeOfIndex = Uint8Array.from(ofIndex, name => SHAPE_CODES[name])
    const { indexOf } = shapeCategories
    for (let i = 0; i < count; i++) {
      glyph[i] = codeOfIndex[indexOf[i]!]!
    }
    shapeScale = {
      kind: 'shape',
      field: shapeScaled.field,
      domain: [...shapeField.domain],
      ...(shapeScaled.range ? { range: [...shapeScaled.range] } : {}),
      entries: entries.map(e => ({ value: e.value, shape: e.entry })),
    }
  }

  let sizeScale: SizeScaleTable | undefined
  if (sizeRef && size) {
    const extent = finiteExtremes(size, count)
    const { domainMin, domainMax } = sizeRef
    sizeScale = {
      field: sizeRef.field,
      scale: sizeRef.scale ?? 'linear',
      domain: rampDomain(domainMin, domainMax, extent),
      pinned: [domainMin !== undefined, domainMax !== undefined],
      range: sizeRef.range ?? DEFAULT_SIZE_RANGE_PX,
      extent,
    }
  }

  const flatbushData =
    has('index') && count > 0 ? hitIndexOf(x, x2, y, count).data : undefined

  const encoded: EncodedChannels = {
    count,
    skipped: n - count,
    skippedPosition,
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
  if (text) {
    encoded.text = text.length === count ? text : text.slice(0, count)
  }
  if (size) {
    encoded.size = size.subarray(0, count)
  }
  if (x2Ref) {
    encoded.x2Ref = x2Ref.subarray(0, count)
    encoded.x2RefNames = x2RefNames
  }
  if (sizeScale) {
    encoded.sizeScale = sizeScale
  }
  if (flatbushData) {
    encoded.flatbushData = flatbushData
  }
  if (scale) {
    encoded.scale = scale
  }
  if (shapeScale) {
    encoded.shapeScale = shapeScale
  }
  return encoded as Encoded<L>
}

function rampMid(
  scale: 'linear' | 'log',
  domain: [number, number],
  domainMid: number | undefined,
) {
  return domainMid === undefined
    ? 0.5
    : makeScoreNormalizer(
        domain[0],
        domain[1],
        scaleTypeCode(scale),
        1,
      )(domainMid)
}

function rampLut(
  stops: readonly ColorRampStop[],
  scale: 'linear' | 'log',
  domain: [number, number],
  domainMid: number | undefined,
) {
  return buildColorRampLut(stops, rampMid(scale, domain, domainMid))
}

/**
 * #api
 * A continuous colour scale over `extent`, the values it met: the domain its
 * declared ends and the extent make, the stops and the table they bake to,
 * and the packed colour a value paints through them: an infinity the end on
 * its side, as a threshold places it, and NaN, text that is no number, the
 * misconfiguration grey. The encoder and every display painting a ramp itself
 * read it, so a value takes one colour whoever paints it.
 */
export function continuousColorScale(
  encoding: ContinuousRef,
  extent: readonly [number, number],
) {
  const { domainMin, domainMax, domainMid, scale } = encoding
  const domain = rampDomain(domainMin, domainMax, extent)
  const norm = makeScoreNormalizer(
    domain[0],
    domain[1],
    scaleTypeCode(scale),
    1,
  )
  const stops = colorRampStops(encoding)
  const lut = rampLut(stops, scale, domain, domainMid)
  return {
    domain,
    stops,
    lut,
    colorOf: (value: number) =>
      Number.isNaN(value)
        ? FALLBACK_COLOR
        : lutColorAt(
            lut,
            Number.isFinite(value) ? norm(value) : value > 0 ? 1 : 0,
          ),
  }
}

const MAX_BAKED_RAMPS = 16
const bakedRamps = new Map<string, Uint8Array>()

/**
 * #api
 * A ramp table over `extent`, the union a display took across the regions it
 * loaded: each open end of the domain moved to the union's, the pinned ends
 * kept, and the table baked again where a `domainMid` places its middle stop
 * by that domain. Each region baked its own, so keeping the first region's
 * put the middle colour at a value none of them declared.
 *
 * One table per stop list and middle position, so a display asking again over
 * an extent that has not moved gets the bytes it already uploaded: a backend
 * re-uploads a ramp on identity.
 */
export function rampOverExtent(
  table: Extract<ColorScaleTable, { kind: 'ramp' }>,
  extent: [number, number],
): Extract<ColorScaleTable, { kind: 'ramp' }> {
  const { stops, pinned } = table
  const domain = rampDomain(
    pinned[0] ? table.domain[0] : undefined,
    pinned[1] ? table.domain[1] : undefined,
    extent,
  )
  if (!stops) {
    return { ...table, extent, domain }
  }
  const mid = rampMid(table.scale, domain, table.domainMid)
  const key = `${mid}|${stops.join(';')}`
  let lut = bakedRamps.get(key)
  if (!lut) {
    if (bakedRamps.size >= MAX_BAKED_RAMPS) {
      bakedRamps.delete(bakedRamps.keys().next().value!)
    }
    lut = buildColorRampLut(stops, mid)
    bakedRamps.set(key, lut)
  }
  return { ...table, extent, domain, lut }
}

function keysAreNumeric(entries: readonly { value: string }[]) {
  const named = entries.filter(e => e.value !== '')
  return named.length > 0 && named.every(e => Number.isFinite(Number(e.value)))
}

// `[Infinity, -Infinity]` where no value is finite, which a union of regions'
// extents passes over.
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
  return [min, max]
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
  for (const lane of [
    c.y,
    c.row,
    c.color,
    c.colorValue,
    c.glyph,
    c.size,
    c.x2Ref,
  ]) {
    if (lane) {
      buffers.push(lane.buffer)
    }
  }
  if (c.flatbushData) {
    buffers.push(c.flatbushData)
  }
  return buffers
}
