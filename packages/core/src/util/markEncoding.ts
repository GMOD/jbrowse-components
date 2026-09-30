import {
  makeScoreNormalizer,
  rampMidNorm,
  scaleTypeCode,
} from '@jbrowse/render-core/scoreScale'
import { rampMidT } from '@jbrowse/render-core/shaders/colorRampLut'
import { RAMP_NO_VALUE_BITS } from '@jbrowse/render-core/shaders/markColorConsts'
import { GLYPH_DISC } from '@jbrowse/render-core/shaders/pointMarkConsts'

import { categoricalScale } from '../ui/colors.ts'
import { categoricalField } from './categoricalField.ts'
import { MISCONFIGURED_COLOR, NO_CATEGORY_COLOR } from './color/index.ts'
import { cssColorToABGR, packAbgr } from './colorBits.ts'
import { rampDomain, rampLutOf } from './colorRamp.ts'
import { asTable, numberReaderOf, readerOf } from './featureTable.ts'
import { fieldReader, isPlainFieldRef } from './fieldReader.ts'
import Flatbush from './flatbush/index.ts'
import { valueText } from './groupKeys.ts'
import { isJexl, stringToJexlExpression } from './jexlStrings.ts'
import { numericValue } from './numericValue.ts'
import { scaleExtent } from './quantileExtent.ts'
import { SHAPE_CODES, SHAPE_NAMES } from './shapeNames.ts'
import { buildJexlContext } from './simpleFeature.ts'
import {
  isMissing,
  thresholdCuts,
  thresholdIndex,
  thresholdPalette,
} from './thresholdScale.ts'

import type { CategoricalField } from './categoricalField.ts'
import type { Column, FeatureTable, NumberLane } from './featureTable.ts'
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

// A channel read by row: a plain field straight off the table's column, a
// path, `jexl:` expression or caller's reader over the row as a `Feature`.
type RowReader<T = unknown> = (i: number) => T

type NumberColumn = Extract<Column, { kind: 'number' }>

function channelReader(
  table: FeatureTable,
  ref: FieldRef | ChannelReader,
  jexl: JexlInstance | undefined,
): RowReader {
  if (typeof ref === 'function') {
    return i => ref(table.row(i))
  }
  if (isPlainFieldRef(ref)) {
    return readerOf(table.column(ref))
  }
  const read = fieldReader(ref, jexl)
  return i => read(table.row(i))
}

// A text channel's reader, printing a float32 lane's value at the digits the
// lane holds rather than the double it widens to: 0.3865, not 0.3865000009.
function textChannelReader(
  table: FeatureTable,
  ref: FieldRef | ChannelReader,
  jexl: JexlInstance | undefined,
): RowReader<string> {
  const read = channelReader(table, ref, jexl)
  const column =
    typeof ref !== 'function' && isPlainFieldRef(ref)
      ? table.column(ref)
      : undefined
  return column?.kind === 'number' && column.values instanceof Float32Array
    ? i => {
        const v = read(i)
        return typeof v === 'number' && !Number.isInteger(v)
          ? String(Number(v.toPrecision(7)))
          : valueText(v)
      }
    : i => valueText(read(i))
}

function numberChannelReader(
  table: FeatureTable,
  ref: FieldRef | ChannelReader,
  jexl: JexlInstance | undefined,
): RowReader<number> {
  if (typeof ref !== 'function' && isPlainFieldRef(ref)) {
    return numberReaderOf(table.column(ref))
  }
  const read = channelReader(table, ref, jexl)
  return i => numericValue(read(i))
}

function isShapeName(shape: string): shape is ShapeName {
  return shape in SHAPE_CODES
}

// A shape named outright is its code, which fills the lane without reading a
// row.
function shapeReader(
  table: FeatureTable,
  shape: Exclude<ShapeEncoding, object> | ChannelReader<number> | undefined,
  jexl: JexlInstance | undefined,
): number | RowReader<number> {
  if (shape === undefined) {
    return GLYPH_DISC
  }
  if (typeof shape === 'function') {
    return i => shape(table.row(i))
  }
  if (isShapeName(shape)) {
    return SHAPE_CODES[shape]
  }
  const expr = jexlExpression(shape, jexl)
  return i => {
    const v = expr.eval(buildJexlContext({ feature: table.row(i) }))
    return typeof v === 'string' && isShapeName(v) ? SHAPE_CODES[v] : GLYPH_DISC
  }
}

function lutColorAt(lut: Uint8Array, t: number) {
  const entries = lut.length / 4
  const i = Math.min(entries - 1, Math.max(0, Math.round(t * (entries - 1))))
  const o = i * 4
  return packAbgr(lut[o]!, lut[o + 1]!, lut[o + 2]!, lut[o + 3]!)
}

// The table row each instance reads, where a row was skipped; with none
// skipped, instance `k` is row `k`.
type Kept = Uint32Array | undefined

// A numeric channel: the lane itself where it names a `number` column, so a
// loop can read it with no call per row, and a reader over any.
interface NumberSource {
  lane: NumberColumn | undefined
  read: RowReader<number>
}

function numberSource(
  table: FeatureTable,
  ref: FieldRef | ChannelReader,
  jexl: JexlInstance | undefined,
): NumberSource {
  return {
    lane: laneOf(table, ref),
    read: numberChannelReader(table, ref, jexl),
  }
}

function laneOf(table: FeatureTable, ref: FieldRef | ChannelReader) {
  if (typeof ref === 'function' || !isPlainFieldRef(ref)) {
    return undefined
  }
  const column = table.column(ref)
  return column.kind === 'number' ? column : undefined
}

// A stacked row reads as `Number` reads it, where a quantitative channel reads
// text by `numericValue`'s rules.
function rowSource(
  table: FeatureTable,
  ref: FieldRef | ChannelReader,
  jexl: JexlInstance | undefined,
): NumberSource {
  const read = channelReader(table, ref, jexl)
  return { lane: laneOf(table, ref), read: i => Number(read(i)) }
}

function isUnsigned(values: NumberLane) {
  return (
    values instanceof Uint32Array ||
    values instanceof Uint16Array ||
    values instanceof Uint8Array
  )
}

// A lane of whole numbers holds no NaN or infinity, so it places every row.
function isWhole(source: NumberSource) {
  const values = source.lane?.values
  return (
    values !== undefined &&
    !(values instanceof Float32Array || values instanceof Float64Array)
  )
}

// The one index a loop reads a lane through for instance `k`: the kept row,
// the lane's own index, or both composed. A loop tests for it once and runs
// with no branch per element, which V8 does not hoist for it.
function laneIndex(kept: Kept, at: Uint32Array | undefined) {
  if (!kept || !at) {
    return kept ?? at
  }
  const index = new Uint32Array(kept.length)
  for (let k = 0; k < kept.length; k++) {
    index[k] = at[kept[k]!]!
  }
  return index
}

// `out[k]`, the value instance `k` reads; into an unsigned lane a negative
// stops at 0 rather than wrapping.
function fillNumbers(
  out: Uint32Array | Float32Array,
  { lane, read }: NumberSource,
  kept: Kept,
  count: number,
) {
  const unsigned = out instanceof Uint32Array
  if (!lane) {
    for (let k = 0; k < count; k++) {
      const v = read(kept ? kept[k]! : k)
      out[k] = unsigned && v < 0 ? 0 : v
    }
    return
  }
  const { values } = lane
  const index = laneIndex(kept, lane.at)
  if (!index && (!unsigned || isUnsigned(values))) {
    out.set(values.subarray(0, count))
  } else if (!index) {
    for (let k = 0; k < count; k++) {
      const v = values[k]!
      out[k] = v < 0 ? 0 : v
    }
  } else if (unsigned) {
    for (let k = 0; k < count; k++) {
      const v = values[index[k]!]!
      out[k] = v < 0 ? 0 : v
    }
  } else {
    for (let k = 0; k < count; k++) {
      out[k] = values[index[k]!]!
    }
  }
}

// The rows that place, and their `x`, `x2` and `y` written: every row where
// all three are lanes of whole numbers, and otherwise each whose three read
// finite. A position before the sequence's first base, a flank run off the
// start or an `END=0`, stops at 0 rather than wrapping the unsigned lane.
function admit(
  sources: { x: NumberSource; x2: NumberSource; y: NumberSource | undefined },
  out: { x: Uint32Array; x2: Uint32Array; y: Float32Array | undefined },
  n: number,
  report: ProgressReporter | undefined,
) {
  const { x, x2, y } = sources
  if (isWhole(x) && isWhole(x2) && (!y || isWhole(y))) {
    fillNumbers(out.x, x, undefined, n)
    fillNumbers(out.x2, x2, undefined, n)
    if (y && out.y) {
      fillNumbers(out.y, y, undefined, n)
    }
    return { kept: undefined, count: n, skippedPosition: 0 }
  }
  const kept = new Uint32Array(n)
  const { x: xs, x2: x2s, y: ys } = out
  const lanes = unindexedLanes(x, x2, y)
  if (lanes) {
    const { count, skippedPosition } = admitLanes(lanes, out, kept, n)
    return {
      kept: count === n ? undefined : kept.subarray(0, count),
      count,
      skippedPosition,
    }
  }
  const readX = x.read
  const readX2 = x2.read
  const readY = y?.read
  let count = 0
  let skippedPosition = 0
  for (let i = 0; i < n; i++) {
    report?.(i)
    const xv = readX(i)
    const x2v = readX2(i)
    const yv = readY ? readY(i) : 0
    if (!Number.isFinite(xv) || !Number.isFinite(x2v)) {
      skippedPosition++
      continue
    }
    if (!Number.isFinite(yv)) {
      continue
    }
    xs[count] = xv < 0 ? 0 : xv
    x2s[count] = x2v < 0 ? 0 : x2v
    if (ys) {
      ys[count] = yv
    }
    kept[count++] = i
  }
  return {
    kept: count === n ? undefined : kept.subarray(0, count),
    count,
    skippedPosition,
  }
}

function unindexedLanes(
  x: NumberSource,
  x2: NumberSource,
  y: NumberSource | undefined,
) {
  const lanes = [x.lane, x2.lane, y?.lane]
  return lanes[0] &&
    !lanes[0].at &&
    lanes[1] &&
    !lanes[1].at &&
    (!y || (lanes[2] && !lanes[2].at))
    ? { x: lanes[0].values, x2: lanes[1].values, y: lanes[2]?.values }
    : undefined
}

// `admit`'s walk read straight off lanes with no index, so no row costs a
// call: with a `y` lane in one loop and without one in another, since V8
// would test for it on every row.
function admitLanes(
  lanes: { x: NumberLane; x2: NumberLane; y: NumberLane | undefined },
  out: { x: Uint32Array; x2: Uint32Array; y: Float32Array | undefined },
  kept: Uint32Array,
  n: number,
) {
  const { x: xl, x2: x2l, y: yl } = lanes
  const { x: xs, x2: x2s } = out
  let count = 0
  let skippedPosition = 0
  if (yl) {
    const ys = out.y!
    for (let i = 0; i < n; i++) {
      const xv = xl[i]!
      const x2v = x2l[i]!
      const yv = yl[i]!
      if (!Number.isFinite(xv) || !Number.isFinite(x2v)) {
        skippedPosition++
      } else if (Number.isFinite(yv)) {
        xs[count] = xv < 0 ? 0 : xv
        x2s[count] = x2v < 0 ? 0 : x2v
        ys[count] = yv
        kept[count++] = i
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      const xv = xl[i]!
      const x2v = x2l[i]!
      if (!Number.isFinite(xv) || !Number.isFinite(x2v)) {
        skippedPosition++
      } else {
        xs[count] = xv < 0 ? 0 : xv
        x2s[count] = x2v < 0 ? 0 : x2v
        kept[count++] = i
      }
    }
  }
  return { count, skippedPosition }
}

// The categorical arm `color` and `shape` share: `out[k]` the lane value of
// the entry instance `k`'s key takes, `''` the key of none, and the keys met
// with their entries in the field's order. A key's entry is its own whatever
// else was met, so two regions agree on every key they share. Over a category
// column each label is keyed once, and the lane written by its code.
function paintCategories<T>(
  table: FeatureTable,
  ref: FieldRef | ChannelReader,
  jexl: JexlInstance | undefined,
  categories: CategoricalField,
  within: { kept: Kept; count: number; report: ProgressReporter | undefined },
  out: Uint32Array | Uint8Array,
  entryOf: (key: string) => T,
  laneValue: (entry: T) => number,
) {
  const { kept, count, report } = within
  const resolved = new Map<string, { entry: T; value: number }>()
  const resolve = (key: string) => {
    let r = resolved.get(key)
    if (r === undefined) {
      const entry = entryOf(key)
      r = { entry, value: laneValue(entry) }
      resolved.set(key, r)
    }
    return r
  }
  const column =
    typeof ref !== 'function' && isPlainFieldRef(ref)
      ? table.column(ref)
      : undefined
  let met: Iterable<string>
  if (column?.kind === 'category') {
    const { codes, labels } = column
    const keyOfCode = labels.map(label => categories.key(label))
    const valueOfCode = Uint32Array.from(keyOfCode, key => resolve(key).value)
    const metCode = new Uint8Array(labels.length)
    const index = laneIndex(kept, column.at)
    if (index) {
      for (let k = 0; k < count; k++) {
        const code = codes[index[k]!]!
        metCode[code] = 1
        out[k] = valueOfCode[code]!
      }
    } else {
      for (let k = 0; k < count; k++) {
        const code = codes[k]!
        metCode[code] = 1
        out[k] = valueOfCode[code]!
      }
    }
    met = new Set(keyOfCode.filter((_, code) => metCode[code]))
  } else {
    const read = channelReader(table, ref, jexl)
    for (let k = 0; k < count; k++) {
      report?.(k)
      out[k] = resolve(categories.key(read(kept ? kept[k]! : k))).value
    }
    met = resolved.keys()
  }
  return [...met]
    .sort(categories.compare)
    .map(value => ({ value, entry: resolved.get(value)!.entry }))
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
 *
 * Columnar: one pass admits the rows over `x`, `x2` and `y` alone, and none
 * runs where all three are lanes of whole numbers; every other lane is then
 * filled in its own loop over the admitted rows, a lane straight off a typed
 * column and a categorical over a `category` column per label.
 */
export function encodeFeatures<L extends LaneName>(
  input: readonly Feature[] | FeatureTable,
  encoding: MarkEncodingInput,
  lanes: readonly L[],
  ctx: EncodeContext = {},
): Encoded<L> {
  const { jexl, report } = ctx
  const table = asTable(input)
  const n = table.length
  const has = (lane: LaneName) => (lanes as readonly LaneName[]).includes(lane)
  const {
    x2: x2Encoding,
    y: yEncoding,
    row: rowEncoding,
    text: textEncoding,
    size: sizeEncoding,
    shape: shapeEncoding,
  } = encoding
  const x2Locus = typeof x2Encoding === 'object' ? x2Encoding : undefined
  const ySource =
    has('y') && yEncoding !== undefined
      ? numberSource(table, yEncoding, jexl)
      : undefined
  const xs = new Uint32Array(n)
  const x2s = new Uint32Array(n)
  const ys = has('y') ? new Float32Array(n) : undefined
  const { kept, count, skippedPosition } = admit(
    {
      x: numberSource(table, encoding.x ?? 'start', jexl),
      x2: numberSource(
        table,
        typeof x2Encoding === 'object' ? x2Encoding.pos : (x2Encoding ?? 'end'),
        jexl,
      ),
      y: ySource,
    },
    { x: xs, x2: x2s, y: ys },
    n,
    report,
  )
  const rowAt = (k: number) => (kept ? kept[k]! : k)
  const y = ys?.subarray(0, count)

  let yMin = Infinity
  let yMax = -Infinity
  if (ySource && y) {
    for (let k = 0; k < count; k++) {
      const v = y[k]!
      if (v < yMin) {
        yMin = v
      }
      if (v > yMax) {
        yMax = v
      }
    }
  }

  let x2Ref: Uint32Array | undefined
  const x2RefNames: string[] = []
  if (has('x2Ref')) {
    x2Ref = new Uint32Array(count)
    const readChrom = x2Locus
      ? channelReader(table, x2Locus.chrom, jexl)
      : undefined
    const readRefName = readerOf(table.column('refName'))
    const refIndex = new Map<string, number>()
    for (let k = 0; k < count; k++) {
      report?.(k)
      const r = rowAt(k)
      const there = readChrom
        ? valueText(readChrom(r))
        : (readRefName(r) as string)
      let ref = refIndex.get(there)
      if (ref === undefined) {
        ref = x2RefNames.length
        refIndex.set(there, ref)
        x2RefNames.push(there)
      }
      x2Ref[k] = ref
    }
  }

  const sizeRef: SizeRef | undefined =
    has('size') &&
    sizeEncoding !== undefined &&
    typeof sizeEncoding !== 'number'
      ? typeof sizeEncoding === 'string'
        ? { field: sizeEncoding }
        : sizeEncoding
      : undefined
  const size = sizeRef ? new Float32Array(count) : undefined
  if (sizeRef && size) {
    fillNumbers(size, numberSource(table, sizeRef.field, jexl), kept, count)
  }

  const row = has('row') ? new Uint32Array(count) : undefined
  if (row && typeof rowEncoding === 'object') {
    if (rowEncoding instanceof Uint32Array && !kept) {
      row.set(rowEncoding.subarray(0, count))
    } else {
      for (let k = 0; k < count; k++) {
        const rv = rowEncoding[rowAt(k)]!
        row[k] = rv > 0 ? rv : 0
      }
    }
  } else if (
    row &&
    rowEncoding !== undefined &&
    typeof rowEncoding !== 'object'
  ) {
    fillNumbers(row, rowSource(table, rowEncoding, jexl), kept, count)
  }

  const text = has('text') ? new Array<string>(count) : undefined
  if (text) {
    if (textEncoding === undefined) {
      text.fill('')
    } else {
      const read = textChannelReader(table, textEncoding, jexl)
      for (let k = 0; k < count; k++) {
        report?.(k)
        text[k] = read(rowAt(k))
      }
    }
  }

  const glyph = has('glyph') ? new Uint8Array(count) : undefined
  let shapeScale: ShapeScaleTable | undefined
  if (glyph && typeof shapeEncoding === 'object') {
    const shapeField = categoricalField(shapeEncoding.field, {
      domain: shapeEncoding.domain?.map(String),
    })
    const range = shapeEncoding.range ?? SHAPE_NAMES
    const shapeOf = categoricalScale(shapeField.domain, range, {
      fallback: range.length > shapeField.domain.length ? [] : SHAPE_NAMES,
    })
    const entries = paintCategories(
      table,
      shapeEncoding.field,
      jexl,
      shapeField,
      { kept, count, report },
      glyph,
      (key): ShapeName => (key === '' ? 'circle' : shapeOf(key)),
      name => SHAPE_CODES[name],
    )
    shapeScale = {
      kind: 'shape',
      field: shapeEncoding.field,
      domain: [...shapeField.domain],
      ...(shapeEncoding.range ? { range: [...shapeEncoding.range] } : {}),
      entries: entries.map(e => ({ value: e.value, shape: e.entry })),
    }
  } else if (glyph && typeof shapeEncoding !== 'object') {
    const shape = shapeReader(table, shapeEncoding, jexl)
    if (typeof shape === 'number') {
      glyph.fill(shape)
    } else {
      for (let k = 0; k < count; k++) {
        report?.(k)
        glyph[k] = shape(rowAt(k))
      }
    }
  }

  const colorEncoding = encoding.color ?? DEFAULT_MARK_COLOR
  const declaredScale =
    typeof colorEncoding === 'object' ? colorEncoding : undefined
  const rampEncoding =
    declaredScale &&
    (declaredScale.scale === 'linear' || declaredScale.scale === 'log')
      ? declaredScale
      : undefined
  const thresholdEncoding =
    declaredScale?.scale === 'threshold' ? declaredScale : undefined
  // Which side of the wire a quantitative colour resolves on is the caller's
  // lane choice: a mark that reads the scale itself names `colorValue` and
  // gets the raw values, so a ramp's domain unions over the regions and a
  // threshold's cuts move as uniforms. Anything else names `color` and the
  // encoder resolves per region. A colour over the field `y` plots is the `y`
  // lane itself, aliased rather than copied.
  const quantitative = rampEncoding ?? thresholdEncoding
  const colorReadsY =
    quantitative !== undefined &&
    has('colorValue') &&
    y !== undefined &&
    typeof yEncoding === 'string' &&
    quantitative.field === yEncoding
  const colorValue =
    quantitative && has('colorValue')
      ? colorReadsY
        ? y
        : new Float32Array(count)
      : undefined
  const paintsColor = has('color') && !colorValue
  const unscaled =
    paintsColor && declaredScale?.scale !== 'categorical' && !quantitative
      ? unscaledColor(
          table,
          colorEncoding as string | ChannelReader<number>,
          jexl,
        )
      : undefined
  const color =
    paintsColor && typeof unscaled !== 'number'
      ? new Uint32Array(count)
      : undefined
  const scaled = paintsColor || colorValue ? declaredScale : undefined
  let scale: ColorScaleTable | undefined
  let missingMet = false
  let notNumberMet = false
  if (scaled?.scale === 'categorical' && color) {
    const colorField = categoricalField(scaled.field, {
      domain: scaled.domain?.map(String),
      range: scaled.range,
    })
    const entries = paintCategories(
      table,
      scaled.field,
      jexl,
      colorField,
      { kept, count, report },
      color,
      key => cssColorToABGR(colorField.color(key)),
      abgr => abgr,
    )
    scale = {
      kind: 'categorical',
      field: scaled.field,
      domain: [...colorField.domain],
      ...(scaled.range ? { range: [...scaled.range] } : {}),
      ...(keysAreNumeric(entries) ? { numericKeys: true } : {}),
      entries: entries.map(e => ({ value: e.value, color: e.entry })),
    }
  } else if (scaled && quantitative) {
    // The raw values, where they are kept: a ramp's always, a threshold's
    // where the caller resolves it; the encoder resolves a threshold into
    // packed colours only for a caller naming `color` alone.
    const values =
      colorValue ?? (rampEncoding ? new Float32Array(count) : undefined)
    const read = channelReader(table, quantitative.field, jexl)
    if (values && !colorReadsY) {
      const bits = new Uint32Array(values.buffer, values.byteOffset, count)
      for (let k = 0; k < count; k++) {
        report?.(k)
        const v = read(rowAt(k))
        if (isMissing(v)) {
          bits[k] = RAMP_NO_VALUE_BITS
          missingMet = true
        } else {
          values[k] = numericValue(v)
          notNumberMet ||= Number.isNaN(values[k])
        }
      }
    }
    if (thresholdEncoding) {
      const cuts = thresholdCuts(thresholdEncoding.domain ?? [])
      if (color) {
        const binColors = Uint32Array.from(
          thresholdPalette(cuts.length + 1, thresholdEncoding.range),
          c => cssColorToABGR(c),
        )
        for (let k = 0; k < count; k++) {
          report?.(k)
          const v = read(rowAt(k))
          const bin = thresholdIndex(v, cuts)
          if (bin >= 0) {
            color[k] = binColors[bin]!
          } else if (isMissing(v)) {
            color[k] = NO_VALUE_ABGR
            missingMet = true
          } else {
            color[k] = FALLBACK_COLOR
            notNumberMet = true
          }
        }
      }
      scale = {
        kind: 'threshold',
        field: thresholdEncoding.field,
        domain: cuts,
        ...(thresholdEncoding.range
          ? { range: [...thresholdEncoding.range] }
          : {}),
        ...(missingMet ? { missing: true } : {}),
        ...(notNumberMet ? { notNumber: true } : {}),
      }
    } else if (rampEncoding && values) {
      scale = rampScale(rampEncoding, values, count, color, {
        missingMet,
        notNumberMet,
      })
    }
  } else if (color && typeof unscaled === 'function') {
    for (let k = 0; k < count; k++) {
      report?.(k)
      color[k] = unscaled(rowAt(k))
    }
  }

  let sizeScale: SizeScaleTable | undefined
  if (sizeRef && size) {
    const scale = sizeRef.scale ?? 'linear'
    const extent = scaleExtent(size, count, scale)
    const { domainMin, domainMax } = sizeRef
    sizeScale = {
      field: sizeRef.field,
      scale,
      domain: rampDomain(domainMin, domainMax, extent),
      pinned: [domainMin !== undefined, domainMax !== undefined],
      range: sizeRef.range ?? DEFAULT_SIZE_RANGE_PX,
      extent,
    }
  }

  const x = xs.subarray(0, count)
  const x2 = x2s.subarray(0, count)
  const flatbushData =
    has('index') && count > 0 ? hitIndexOf(x, x2, y, count).data : undefined

  const encoded: EncodedChannels = {
    count,
    skipped: n - count,
    skippedPosition,
    x,
    x2,
    yMin,
    yMax,
  }
  if (kept) {
    encoded.featureIndex = kept
  }
  if (y) {
    encoded.y = y
  }
  if (row) {
    encoded.row = row
  }
  if (typeof unscaled === 'number') {
    encoded.color = unscaled
  } else if (color) {
    encoded.color = color
  }
  if (colorValue) {
    // the y view itself where the colour reads y, so a reader can tell
    encoded.colorValue = colorValue
  }
  if (glyph) {
    encoded.glyph = glyph
  }
  if (text) {
    encoded.text = text
  }
  if (size) {
    encoded.size = size
  }
  if (x2Ref) {
    encoded.x2Ref = x2Ref
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

// A ramp's table over the values it met, painting `color` through it where
// the encoder resolves the scale.
function rampScale(
  rampEncoding: ContinuousRef,
  values: Float32Array,
  count: number,
  color: Uint32Array | undefined,
  met: { missingMet: boolean; notNumberMet: boolean },
): ColorScaleTable {
  const extent = scaleExtent(
    values,
    count,
    rampEncoding.scale,
    rampEncoding.domainQuantile,
  )
  const {
    domainMin,
    domainMax,
    domainMid,
    domainQuantile,
    range,
    scheme,
    reverse,
  } = rampEncoding
  const { domain, lut, colorOf } = continuousColorScale(rampEncoding, extent)
  if (color) {
    const bits = new Uint32Array(values.buffer, values.byteOffset, count)
    for (let k = 0; k < count; k++) {
      color[k] =
        bits[k] === RAMP_NO_VALUE_BITS ? NO_VALUE_ABGR : colorOf(values[k]!)
    }
  }
  return {
    kind: 'ramp',
    field: rampEncoding.field,
    scale: rampEncoding.scale,
    domain,
    pinned: [domainMin !== undefined, domainMax !== undefined],
    ...(domainMid === undefined ? {} : { domainMid }),
    ...(range ? { range: [...range] } : {}),
    ...(scheme ? { scheme } : {}),
    ...(reverse ? { reverse } : {}),
    extent,
    ...(domainQuantile !== undefined && domainQuantile < 1
      ? { quantile: domainQuantile }
      : {}),
    lut,
    ...(met.missingMet ? { missing: true } : {}),
    ...(met.notNumberMet ? { notNumber: true } : {}),
  }
}

/**
 * #api
 * A continuous colour scale over `extent`, the values it met: the domain its
 * declared ends and the extent make, the straight table its stops bake to and
 * where its middle stop sits, and the packed colour a value paints through
 * them: an infinity the end on its side, as a threshold places it, and NaN,
 * text that is no number, the misconfiguration grey. The encoder and every
 * display painting a ramp itself read it, so a value takes one colour whoever
 * paints it.
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
  const lut = rampLutOf(encoding)
  const midNorm = rampMidNorm(
    domain[0],
    domain[1],
    scaleTypeCode(scale),
    domainMid,
  )
  return {
    domain,
    lut,
    midNorm,
    colorOf: (value: number) =>
      Number.isNaN(value)
        ? FALLBACK_COLOR
        : lutColorAt(
            lut,
            rampMidT(
              Number.isFinite(value) ? norm(value) : value > 0 ? 1 : 0,
              midNorm,
            ),
          ),
  }
}

/**
 * #api
 * A ramp table over `extent`, the union a display took across the regions it
 * loaded: each open end of the domain moved to the union's, the pinned ends
 * kept. The table stays straight and `domainMid` a value, so the middle stop
 * follows the widened domain with no table baked again.
 */
export function rampOverExtent(
  table: Extract<ColorScaleTable, { kind: 'ramp' }>,
  extent: [number, number],
): Extract<ColorScaleTable, { kind: 'ramp' }> {
  const { pinned } = table
  const domain = rampDomain(
    pinned[0] ? table.domain[0] : undefined,
    pinned[1] ? table.domain[1] : undefined,
    extent,
  )
  return { ...table, extent, domain }
}

function keysAreNumeric(entries: readonly { value: string }[]) {
  const named = entries.filter(e => e.value !== '')
  return named.length > 0 && named.every(e => Number.isFinite(Number(e.value)))
}

// `[Infinity, -Infinity]` where no value is finite, which a union of regions'
// extents passes over.
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

function unscaledColor(
  table: FeatureTable,
  color: string | ChannelReader<number>,
  jexl: JexlInstance | undefined,
): number | RowReader<number> {
  if (typeof color === 'function') {
    return i => color(table.row(i))
  }
  if (!isJexl(color)) {
    return cssColorToABGR(color)
  }
  const colorOf = colorEvaluator(color, jexl)
  return i => colorOf(table.row(i))
}

/**
 * #api
 * The input feature instance `i` of `channels` was: `featureIndex[i]`, or `i`
 * itself where the encoder skipped none and so shipped no index.
 */
export function featureIndexAt(
  channels: Pick<EncodedChannels, 'featureIndex'>,
  i: number,
) {
  const { featureIndex } = channels
  return featureIndex ? featureIndex[i]! : i
}

/**
 * #api
 * The packed colour instance `i` of `channels` paints: `color[i]`, or `color`
 * itself where the colour is a constant and so shipped as one number.
 */
export function colorAt(channels: Pick<EncodedChannels, 'color'>, i: number) {
  const { color } = channels
  return typeof color === 'number' ? color : color?.[i]
}

/**
 * #api
 * The buffers an {@link EncodedChannels} owns, for `rpcResult`'s transfer
 * list.
 */
export function encodedChannelTransferables(c: EncodedChannels) {
  // A set, since `colorValue` may be the `y` lane itself and a buffer listed
  // twice fails the transfer.
  const buffers = new Set<ArrayBufferLike>([c.x.buffer, c.x2.buffer])
  for (const lane of [
    c.featureIndex,
    c.y,
    c.row,
    typeof c.color === 'number' ? undefined : c.color,
    c.colorValue,
    c.glyph,
    c.size,
    c.x2Ref,
  ]) {
    if (lane) {
      buffers.add(lane.buffer)
    }
  }
  if (c.flatbushData) {
    buffers.add(c.flatbushData)
  }
  return [...buffers]
}
