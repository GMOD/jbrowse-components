import { linkFeet } from '@jbrowse/render-core/linkFeet'
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
import {
  BED_COLOR_FIELDS,
  cssColorToABGR,
  featureItemRgb,
  packAbgr,
} from './colorBits.ts'
import { rampDomain, rampLutOf } from './colorRamp.ts'
import { asTable, numberReaderOf, readerOf } from './featureTable.ts'
import { fieldReader, isConstantJexl, plainFieldName } from './fieldReader.ts'
import Flatbush from './flatbush/index.ts'
import { valueText } from './groupKeys.ts'
import { isJexl, stringToJexlExpression } from './jexlStrings.ts'
import { numericValue } from './numericValue.ts'
import { scaleExtent } from './quantileExtent.ts'
import { DEFAULT_SHAPE_RANGE, SHAPE_CODES } from './shapeNames.ts'
import { buildJexlContext } from './simpleFeature.ts'
import { rootRowOf } from './stepTables.ts'
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
  ColorScaleTable,
  ContinuousRef,
  Encoded,
  EncodedChannels,
  FieldRef,
  IdentityRef,
  LocusRef,
  MarkColorEncoding,
  ShapeEncoding,
  ShapeName,
  ShapeScaleTable,
  SizeEncoding,
  SizeRef,
  SizeScaleTable,
  ThresholdRef,
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
  IdentityRef,
  LocusRef,
  MarkColorEncoding,
  MateStep,
  PathSpec,
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
  WindowStep,
} from './markEncodingTypes.ts'
export type { ColorSchemeName } from './colorSchemes.ts'
export { COLOR_SCHEMES } from './colorSchemes.ts'

export { NO_VALUE_LABEL } from './categoricalField.ts'

export const DEFAULT_MARK_COLOR = '#0068d1'

export const DEFAULT_SIZE_RANGE_PX: [number, number] = [1, 6]

/**
 * #api
 * The misconfiguration grey packed as the encoder paints it: a `jexl:` color
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

const DEFAULT_MARK_ABGR = cssColorToABGR(DEFAULT_MARK_COLOR)

const INVALID_COLOR_ABGR = cssColorToABGR('')

/**
 * #api
 * A channel read per feature: the compiled form of a {@link FieldRef}, and
 * what a display's worker method passes to the encoder for a channel that no
 * field name can express — a join against a second adapter, a lookup table, a
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
  /** Each row's series, what the `series` lane is filled from. */
  series?: ArrayLike<number>
  color?: MarkColorEncoding | ChannelReader<number>
  shape?: ShapeEncoding | ChannelReader<number>
  text?: FieldRef | ChannelReader
  size?: SizeEncoding
}

/**
 * #api
 * What surrounds an encode: the jexl instance a `jexl:` channel compiles
 * against — a caller whose channels are all readers or field names passes
 * none — a progress reporter, and the region's fetched features a `root`
 * lane names rows of.
 */
export interface EncodeContext {
  jexl?: JexlInstance
  report?: ProgressReporter
  root?: FeatureTable
}

/** The `root` of an instance standing for a row of its own. */
export const NO_ROOT = 0xffffffff

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
  const name = plainFieldName(ref)
  if (name !== undefined) {
    return readerOf(table.column(name))
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
  const column = plainColumn(table, ref)
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
  const column = plainColumn(table, ref)
  if (column) {
    return numberReaderOf(column)
  }
  const read = channelReader(table, ref, jexl)
  return i => numericValue(read(i))
}

// A far end stated as `mate.start` carries its direction as
// `mate.mateDirection`, beside the record's own.
function feetLane(
  table: FeatureTable,
  farPos: FieldRef,
  count: number,
  rowAt: (k: number) => number,
  jexl: JexlInstance | undefined,
) {
  const dot = farPos.lastIndexOf('.')
  const farDirection = `${farPos.slice(0, dot)}.mateDirection`
  if (dot === -1 || isJexl(farPos)) {
    return undefined
  }
  const own = numberChannelReader(table, 'mateDirection', jexl)
  const far = numberChannelReader(table, farDirection, jexl)
  const feet = new Uint8Array(count)
  let any = false
  for (let k = 0; k < count; k++) {
    const r = rowAt(k)
    feet[k] = linkFeet(own(r), far(r))
    any ||= feet[k] !== 0
  }
  return any ? feet : undefined
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
  const column = plainColumn(table, ref)
  return column?.kind === 'number' ? column : undefined
}

function plainColumn(table: FeatureTable, ref: FieldRef | ChannelReader) {
  const name = typeof ref === 'function' ? undefined : plainFieldName(ref)
  return name === undefined ? undefined : table.column(name)
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

interface LaneContext {
  table: FeatureTable
  jexl: JexlInstance | undefined
  kept: Kept
  count: number
  report: ProgressReporter | undefined
  rowAt: (k: number) => number
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
  const column = plainColumn(table, ref)
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

// The BED color column a table holds, under the first of its names any row
// fills; a file spells it one way throughout.
function bedColorFieldOf(table: FeatureTable) {
  const readers = BED_COLOR_FIELDS.map(field => ({
    field,
    read: readerOf(table.column(field)),
  }))
  for (let i = 0; i < table.length; i++) {
    for (const { field, read } of readers) {
      if (read(i) !== undefined) {
        return field
      }
    }
  }
  return BED_COLOR_FIELDS[0]
}

const MAX_COLOR_LABELS = 8

// The `labelField` values of the features painted in each color, keyed as
// the color's entry is, first met first and a few per color.
function colorLabels(
  table: FeatureTable,
  colorRef: FieldRef,
  labelRef: FieldRef,
  colors: CategoricalField,
  { kept, count }: { kept: Kept; count: number },
  jexl: JexlInstance | undefined,
) {
  const readColor = channelReader(table, colorRef, jexl)
  const readLabel = textChannelReader(table, labelRef, jexl)
  const labels = new Map<string, Set<string>>()
  for (let k = 0; k < count; k++) {
    const r = kept ? kept[k]! : k
    const key = colors.key(readColor(r))
    const label = readLabel(r)
    if (label === '') {
      continue
    }
    let set = labels.get(key)
    if (!set) {
      set = new Set()
      labels.set(key, set)
    }
    if (set.size < MAX_COLOR_LABELS) {
      set.add(label)
    }
  }
  return labels
}

// A field's CSS color as its key, `''` for a feature holding none.
function cssColorField(): CategoricalField {
  return {
    ...categoricalField(''),
    key: raw => (raw === undefined || raw === null ? '' : String(raw)),
  }
}

// A feature's own color as its key: the `r,g,b` its raw value parses to under
// UCSC's `itemRgb on`, `''` for none, each distinct raw value parsed once.
function ownColorField(): CategoricalField {
  const parsed = new Map<unknown, string>()
  return {
    ...categoricalField(''),
    key: raw => {
      let key = parsed.get(raw)
      if (key === undefined) {
        key = featureItemRgb(raw, true) ?? ''
        parsed.set(raw, key)
      }
      return key
    },
  }
}

// A `colorKey` lane's indexes, handed out in the order keys were first met,
// moved to each key's position in `entries`.
function keysToEntryOrder(
  colorKey: Uint32Array,
  entries: readonly { entry: { order: number } }[],
  resolved: number,
  count: number,
) {
  const position = new Uint32Array(resolved)
  for (const [i, e] of entries.entries()) {
    position[e.entry.order] = i
  }
  for (let k = 0; k < count; k++) {
    colorKey[k] = position[colorKey[k]!]!
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

function rootLane(walk: LaneContext, root: FeatureTable) {
  const { table, count, rowAt } = walk
  const rows = new Uint32Array(count)
  for (let k = 0; k < count; k++) {
    rows[k] = rootRowOf(table, rowAt(k), root) ?? NO_ROOT
  }
  return { root: rows }
}

function yExtentOf(y: Float32Array | undefined) {
  let yMin = Infinity
  let yMax = -Infinity
  if (y) {
    for (let k = 0; k < y.length; k++) {
      const v = y[k]!
      if (v < yMin) {
        yMin = v
      }
      if (v > yMax) {
        yMax = v
      }
    }
  }
  return { yMin, yMax }
}

function x2RefLane(walk: LaneContext, x2Locus: LocusRef | undefined) {
  const { table, jexl, report, count, rowAt } = walk
  const x2Ref = new Uint32Array(count)
  const x2RefNames: string[] = []
  const readChrom = x2Locus
    ? channelReader(table, x2Locus.refName, jexl)
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
  return { x2Ref, x2RefNames }
}

function sizeLane(walk: LaneContext, sizeEncoding: SizeEncoding | undefined) {
  const { table, jexl, kept, count } = walk
  const sizeRef: SizeRef | undefined =
    sizeEncoding !== undefined && typeof sizeEncoding !== 'number'
      ? typeof sizeEncoding === 'string'
        ? { field: sizeEncoding }
        : sizeEncoding
      : undefined
  let channels: { size: Float32Array; sizeScale: SizeScaleTable } | undefined
  if (sizeRef) {
    const size = new Float32Array(count)
    fillNumbers(size, numberSource(table, sizeRef.field, jexl), kept, count)
    const scale = sizeRef.scale ?? 'linear'
    const extent = scaleExtent(size, count, scale)
    const { domainMin, domainMax } = sizeRef
    channels = {
      size,
      sizeScale: {
        field: sizeRef.field,
        scale,
        domain: rampDomain(domainMin, domainMax, extent),
        pinned: [domainMin !== undefined, domainMax !== undefined],
        range: sizeRef.range ?? DEFAULT_SIZE_RANGE_PX,
        extent,
      },
    }
  }
  return channels
}

function rowLane(walk: LaneContext, rowEncoding: MarkEncodingInput['row']) {
  const { table, jexl, kept, count, rowAt } = walk
  const row = new Uint32Array(count)
  if (typeof rowEncoding === 'object') {
    if (rowEncoding instanceof Uint32Array && !kept) {
      row.set(rowEncoding.subarray(0, count))
    } else {
      for (let k = 0; k < count; k++) {
        const rv = rowEncoding[rowAt(k)]!
        row[k] = rv > 0 ? rv : 0
      }
    }
  } else if (rowEncoding !== undefined) {
    fillNumbers(row, rowSource(table, rowEncoding, jexl), kept, count)
  }
  return { row }
}

function seriesLane(walk: LaneContext, seriesOf: MarkEncodingInput['series']) {
  const { count, rowAt } = walk
  const series = new Uint32Array(count)
  if (seriesOf) {
    for (let k = 0; k < count; k++) {
      series[k] = seriesOf[rowAt(k)]!
    }
  }
  return { series }
}

function textLane(walk: LaneContext, textEncoding: MarkEncodingInput['text']) {
  const { table, jexl, report, count, rowAt } = walk
  const text = new Array<string>(count)
  if (textEncoding === undefined) {
    text.fill('')
  } else {
    const read = textChannelReader(table, textEncoding, jexl)
    for (let k = 0; k < count; k++) {
      report?.(k)
      text[k] = read(rowAt(k))
    }
  }
  return { text }
}

function glyphLane(
  walk: LaneContext,
  shapeEncoding: MarkEncodingInput['shape'],
) {
  const { table, jexl, report, count, rowAt } = walk
  const glyph = new Uint8Array(count)
  let shapeScale: ShapeScaleTable | undefined
  if (typeof shapeEncoding === 'object') {
    const shapeField = categoricalField(shapeEncoding.field, {
      domain: shapeEncoding.domain?.map(String),
    })
    const range = shapeEncoding.range ?? DEFAULT_SHAPE_RANGE
    const shapeOf = categoricalScale(shapeField.domain, range, {
      fallback:
        range.length > shapeField.domain.length ? [] : DEFAULT_SHAPE_RANGE,
    })
    const entries = paintCategories(
      table,
      shapeEncoding.field,
      jexl,
      shapeField,
      walk,
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
  } else {
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
  return shapeScale ? { glyph, shapeScale } : { glyph }
}

interface ColorWants {
  color: boolean
  colorValue: boolean
  colorKey: boolean
}

interface YLane {
  y: Float32Array | undefined
  field: string | undefined
}

function colorLanes(
  walk: LaneContext,
  colorEncoding: MarkColorEncoding | ChannelReader<number>,
  wants: ColorWants,
  yLane: YLane,
) {
  return typeof colorEncoding === 'object'
    ? scaledColorLanes(walk, colorEncoding, wants, yLane)
    : wants.color
      ? plainColors(walk, colorEncoding)
      : undefined
}

function scaledColorLanes(
  walk: LaneContext,
  colorEncoding: Exclude<MarkColorEncoding, string>,
  wants: ColorWants,
  yLane: YLane,
) {
  switch (colorEncoding.scale) {
    case 'identity':
      return wants.color || wants.colorKey
        ? identityColors(walk, colorEncoding, wants.colorKey)
        : undefined
    case 'ordinal':
      return wants.color || wants.colorKey
        ? ordinalColors(walk, colorEncoding, wants.colorKey)
        : undefined
    case 'threshold':
      return wants.color || wants.colorValue
        ? thresholdColors(walk, colorEncoding, wants, yLane)
        : undefined
    case 'linear':
    case 'log':
    case 'symlog':
      return wants.color || wants.colorValue
        ? rampColors(walk, colorEncoding, wants, yLane)
        : undefined
    default:
      return wants.color ? { color: INVALID_COLOR_ABGR } : undefined
  }
}

function fillColor(walk: LaneContext, colorOf: RowReader<number>) {
  const { report, count, rowAt } = walk
  const color = new Uint32Array(count)
  for (let k = 0; k < count; k++) {
    report?.(k)
    color[k] = colorOf(rowAt(k))
  }
  return color
}

function plainColors(
  walk: LaneContext,
  colorEncoding: string | ChannelReader<number>,
) {
  const unscaled = unscaledColor(walk.table, colorEncoding, walk.jexl)
  return {
    color: typeof unscaled === 'number' ? unscaled : fillColor(walk, unscaled),
  }
}

// Paints the categories of `ref` into a lane of packed colors, or with `keyed`
// into each instance's index in the returned entries, which are in the order of
// the field's keys rather than of first meeting.
function categoryColors(
  walk: LaneContext,
  ref: FieldRef,
  categories: CategoricalField,
  keyed: boolean,
  colorOf: (key: string) => number,
) {
  const lane = new Uint32Array(walk.count)
  let resolved = 0
  const entries = paintCategories(
    walk.table,
    ref,
    walk.jexl,
    categories,
    walk,
    lane,
    key => ({ color: colorOf(key), order: resolved++ }),
    entry => (keyed ? entry.order : entry.color),
  )
  if (keyed) {
    keysToEntryOrder(lane, entries, resolved, walk.count)
  }
  return { entries, channel: keyed ? { colorKey: lane } : { color: lane } }
}

// The field an identity color reads and how it keys each value.
function identityKeying(table: FeatureTable, { field }: IdentityRef) {
  return field === undefined
    ? { ref: bedColorFieldOf(table), categories: ownColorField() }
    : { ref: field, categories: cssColorField() }
}

function identityKeyColor(key: string) {
  return key === '' ? DEFAULT_MARK_ABGR : cssColorToABGR(key)
}

/**
 * #api
 * What a categorical color's key lists each row of `table` under, as the
 * encoder lists it: an ordinal color's category, an identity color's packed
 * color. Undefined for a color whose key lists no categories.
 */
export function colorEntryReader(
  table: FeatureTable,
  color: MarkColorEncoding,
  jexl?: JexlInstance,
): ((i: number) => string | number) | undefined {
  if (typeof color === 'object' && color.scale === 'identity') {
    const { ref, categories } = identityKeying(table, color)
    const read = channelReader(table, ref, jexl)
    return i => identityKeyColor(categories.key(read(i)))
  } else if (typeof color === 'object' && color.scale === 'ordinal') {
    const categories = categoricalField(color.field)
    const read = channelReader(table, color.field, jexl)
    return i => categories.key(read(i))
  } else {
    return undefined
  }
}

function identityColors(
  walk: LaneContext,
  identity: Extract<MarkColorEncoding, { scale: 'identity' }>,
  keyed: boolean,
) {
  const { labelField } = identity
  const { ref: colorRef, categories } = identityKeying(walk.table, identity)
  const { entries, channel } = categoryColors(
    walk,
    colorRef,
    categories,
    keyed,
    identityKeyColor,
  )
  const labels = labelField
    ? colorLabels(walk.table, colorRef, labelField, categories, walk, walk.jexl)
    : undefined
  const scale: ColorScaleTable = {
    kind: 'identity',
    field: '',
    domain: [],
    entries: entries.map(e => {
      const named = labels?.get(e.value)
      return named
        ? { value: e.value, color: e.entry.color, labels: [...named] }
        : { value: e.value, color: e.entry.color }
    }),
  }
  return { ...channel, scale }
}

function ordinalColors(
  walk: LaneContext,
  ordinal: Extract<MarkColorEncoding, { scale: 'ordinal' }>,
  keyed: boolean,
) {
  const colorField = categoricalField(ordinal.field, {
    domain: ordinal.domain?.map(String),
    range: ordinal.range,
  })
  const { entries, channel } = categoryColors(
    walk,
    ordinal.field,
    colorField,
    keyed,
    key => cssColorToABGR(colorField.color(key)),
  )
  const scale: ColorScaleTable = {
    kind: 'categorical',
    field: ordinal.field,
    domain: [...colorField.domain],
    ...(ordinal.range ? { range: [...ordinal.range] } : {}),
    ...(keysAreNumeric(entries) ? { numericKeys: true } : {}),
    entries: entries.map(e => ({ value: e.value, color: e.entry.color })),
  }
  return { ...channel, scale }
}

// Which side of the wire a quantitative color resolves on is the caller's
// lane choice: a mark that reads the scale itself names `colorValue` and
// gets the raw values, so a ramp's domain unions over the regions and a
// threshold's cuts move as uniforms. Anything else names `color` and the
// encoder resolves per region. A color over the field `y` plots is the `y`
// lane itself, aliased rather than copied.
function quantitativeLanes(
  walk: LaneContext,
  field: FieldRef,
  wants: ColorWants,
  yLane: YLane,
) {
  const aliasedY =
    wants.colorValue && yLane.y && field === yLane.field ? yLane.y : undefined
  const colorValue = wants.colorValue
    ? (aliasedY ?? new Float32Array(walk.count))
    : undefined
  const color =
    wants.color && !colorValue ? new Uint32Array(walk.count) : undefined
  return { aliasedY, colorValue, color }
}

function readRawValues(
  walk: LaneContext,
  read: RowReader,
  values: Float32Array,
) {
  const { report, count, rowAt } = walk
  const bits = new Uint32Array(values.buffer, values.byteOffset, count)
  let missingMet = false
  let notNumberMet = false
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
  return { missingMet, notNumberMet }
}

function rampColors(
  walk: LaneContext,
  ramp: ContinuousRef,
  wants: ColorWants,
  yLane: YLane,
) {
  const { table, jexl, count } = walk
  const { aliasedY, colorValue, color } = quantitativeLanes(
    walk,
    ramp.field,
    wants,
    yLane,
  )
  const values = colorValue ?? new Float32Array(count)
  const read = channelReader(table, ramp.field, jexl)
  const met = aliasedY
    ? { missingMet: false, notNumberMet: false }
    : readRawValues(walk, read, values)
  return {
    ...(color ? { color } : undefined),
    ...(colorValue ? { colorValue } : undefined),
    scale: rampScale(ramp, values, count, color, met),
  }
}

function thresholdColors(
  walk: LaneContext,
  threshold: ThresholdRef,
  wants: ColorWants,
  yLane: YLane,
) {
  const { table, jexl, report, count, rowAt } = walk
  const { aliasedY, colorValue, color } = quantitativeLanes(
    walk,
    threshold.field,
    wants,
    yLane,
  )
  const read = channelReader(table, threshold.field, jexl)
  const raw =
    colorValue && !aliasedY
      ? readRawValues(walk, read, colorValue)
      : { missingMet: false, notNumberMet: false }
  let { missingMet, notNumberMet } = raw
  const cuts = thresholdCuts(threshold.domain ?? [])
  if (color) {
    const binColors = Uint32Array.from(
      thresholdPalette(cuts.length + 1, threshold.range),
      c => cssColorToABGR(c),
    )
    // in float32 on both sides, as the shader and the key compare, so a
    // value off a float32 lane sits at a cut like 0.7 rather than under it
    const cuts32 = cuts.map(cut => Math.fround(cut))
    for (let k = 0; k < count; k++) {
      report?.(k)
      const v = read(rowAt(k))
      const bin = thresholdIndex(Math.fround(numericValue(v)), cuts32)
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
  const scale: ColorScaleTable = {
    kind: 'threshold',
    field: threshold.field,
    domain: cuts,
    ...(threshold.range ? { range: [...threshold.range] } : {}),
    ...(missingMet ? { missing: true } : {}),
    ...(notNumberMet ? { notNumber: true } : {}),
  }
  return {
    ...(color ? { color } : undefined),
    ...(colorValue ? { colorValue } : undefined),
    scale,
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
 * filled in a separate loop over the admitted rows, a lane straight off a typed
 * column and a categorical over a `category` column per label.
 */
export function encodeFeatures<L extends LaneName>(
  input: readonly Feature[] | FeatureTable,
  encoding: MarkEncodingInput,
  lanes: readonly L[],
  ctx: EncodeContext = {},
): Encoded<L> {
  const { jexl, report, root } = ctx
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
  const walk: LaneContext = { table, jexl, report, kept, count, rowAt }
  const y = ys?.subarray(0, count)
  const rootChannels = has('root') ? rootLane(walk, root ?? table) : undefined
  const { yMin, yMax } = yExtentOf(ySource ? y : undefined)
  const x2RefChannels = has('x2Ref') ? x2RefLane(walk, x2Locus) : undefined
  const feet =
    x2RefChannels && x2Locus
      ? feetLane(table, x2Locus.pos, count, rowAt, jexl)
      : undefined
  const sizeChannels = has('size') ? sizeLane(walk, sizeEncoding) : undefined
  const rowChannels = has('row') ? rowLane(walk, rowEncoding) : undefined
  const seriesChannels = has('series')
    ? seriesLane(walk, encoding.series)
    : undefined
  const textChannels = has('text') ? textLane(walk, textEncoding) : undefined
  const glyphChannels = has('glyph')
    ? glyphLane(walk, shapeEncoding)
    : undefined

  const colorChannels = colorLanes(
    walk,
    encoding.color ?? DEFAULT_MARK_COLOR,
    {
      color: has('color'),
      colorValue: has('colorValue'),
      colorKey: has('colorKey'),
    },
    { y, field: typeof yEncoding === 'string' ? yEncoding : undefined },
  )

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
    ...(kept ? { featureIndex: kept } : undefined),
    ...rootChannels,
    ...(y ? { y } : undefined),
    ...rowChannels,
    ...colorChannels,
    ...glyphChannels,
    ...seriesChannels,
    ...textChannels,
    ...sizeChannels,
    ...x2RefChannels,
    ...(feet ? { feet } : undefined),
    ...(flatbushData ? { flatbushData } : undefined),
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
      ? {
          quantile: domainQuantile,
          extremes: scaleExtent(values, count, rampEncoding.scale),
        }
      : {}),
    lut,
    ...(met.missingMet ? { missing: true } : {}),
    ...(met.notNumberMet ? { notNumber: true } : {}),
  }
}

/**
 * #api
 * A continuous color scale over `extent`, the values it met: the domain its
 * declared ends and the extent make, the straight table its stops bake to and
 * where its middle stop sits, and the packed color a value paints through
 * them: an infinity the end on its side, as a threshold places it, and NaN,
 * text that is no number, the misconfiguration grey. The encoder and every
 * display painting a ramp itself read it, so a value takes one color whoever
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
 * A CSS color or `jexl:` color expression as a per-feature packed ABGR —
 * the unscaled arm of {@link ColorEncoding}, used by a display that has a
 * plain `color` slot.
 */
export function colorEvaluator(
  color: string,
  jexl: JexlInstance | undefined,
): (feature: Feature) => number {
  if (isJexl(color) && !isConstantJexl(color)) {
    const expr = jexlExpression(color, jexl)
    // A jexl color answers from a handful of strings over a million
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
  const constant = constantColor(color, jexl)
  return () => constant
}

function constantColor(color: string, jexl: JexlInstance | undefined) {
  if (!isJexl(color)) {
    return cssColorToABGR(color)
  }
  const v = jexlExpression(color, jexl).eval()
  return typeof v === 'string' ? cssColorToABGR(v) : FALLBACK_COLOR
}

function unscaledColor(
  table: FeatureTable,
  color: string | ChannelReader<number>,
  jexl: JexlInstance | undefined,
): number | RowReader<number> {
  if (typeof color === 'function') {
    return i => color(table.row(i))
  }
  if (!isJexl(color) || isConstantJexl(color)) {
    return constantColor(color, jexl)
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
 * The packed color instance `i` of `channels` paints: `color[i]`, or `color`
 * itself where the color is a constant and so shipped as one number.
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
    c.root,
    c.y,
    c.row,
    c.series,
    typeof c.color === 'number' ? undefined : c.color,
    c.colorValue,
    c.colorKey,
    c.glyph,
    c.size,
    c.x2Ref,
    c.feet,
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
