// The declared shape of a mark encoding and what evaluating one produces —
// split from markEncoding.ts because that file's runtime half reaches
// render-core's whole HAL/color-ramp graph for encodeFeatures' native scale
// tables, and RpcRegistry.ts needs only these types for CoreGetEncodedLayers'
// wire shape. Importing them from markEncoding.ts would carry that graph into
// every leaf that reaches the RPC registry. scripts/moduleClosure.test.ts
// holds the ceiling.

import type { ZoomRange } from '../data_adapters/BaseAdapter/zoomRange.ts'
import type { ColorSchemeName } from './colorSchemes.ts'

/**
 * #api
 * Where a channel's value comes from: a feature field name, read natively
 * (`feature.get(name)`), or a `jexl:` expression over `feature` — the opt-in
 * escape, measured at 1.5x to 2.0x native per feature (MARK_ENCODING.md
 * "The jexl channel, measured").
 */
export type FieldRef = string

/**
 * #api
 * A field bound to a categorical scale: each distinct value takes one entry
 * of the channel's `range` — a colour for `color`, a shape name for
 * `shape`. Every value derives its entry from itself (an integer takes the
 * slot it names, anything else hashes in), so every region agrees on a value
 * it shares with another at the cost of an occasional collision. A `domain`
 * spends the range deliberately: the listed values take it in order, and a
 * value the domain leaves out never takes a listed value's entry. The domain
 * orders and spends; it never adds a value the data lacks.
 */
export interface CategoricalRef {
  field: FieldRef
  scale: 'categorical'
  domain?: (string | number)[]
  /** What a key names each `domain` value, one each in order. */
  labels?: string[]
}

/**
 * #api
 * A numeric field cut into intervals: `domain` is the ascending cut points
 * and `range` holds one colour more, so a value paints the entry for the
 * number of cut points it is at or past. A value that is not a number
 * belongs to no interval.
 */
export interface ThresholdRef {
  field: FieldRef
  scale: 'threshold'
  domain?: (string | number)[]
  range?: string[]
  /** What the key names each bin, one each from the lowest. */
  labels?: string[]
}

/**
 * #api
 * A numeric field read through a linear or log scale into a ramp. Each end of
 * the domain is pinned by `domainMin` or `domainMax`, or is the region's own
 * extreme where unset, so pinning both keeps colours consistent across a
 * whole view. The ramp is `range`'s CSS colours, evenly spaced, where it
 * lists any, else the named `scheme`; `reverse` turns it round.
 */
export interface ContinuousRef {
  field: FieldRef
  scale: 'linear' | 'log'
  domainMin?: number
  domainMax?: number
  /** The value the ramp's middle stop sits at; the domain's centre unset. */
  domainMid?: number
  range?: string[]
  scheme?: ColorSchemeName
  reverse?: boolean
  /**
   * The quantile an open end follows over the loaded values: 1 their
   * extremes, 0.99 clips the outermost 1% at each end, each sign on its own.
   */
  domainQuantile?: number
}

/**
 * #api
 * How a mark's `color` channel resolves. A CSS colour or a `jexl:` expression
 * returning one paints per feature with no scale; the object forms bind a
 * field to a scale, which a legend can describe, and share the config's
 * member names.
 */
export type ColorEncoding =
  | string
  | (CategoricalRef & { range?: string[] })
  | ContinuousRef
  | ThresholdRef

export type ShapeName = 'circle' | 'triangle-down' | 'diamond'

/**
 * #api
 * A {@link ShapeName}, a `jexl:` expression over `feature` returning one, or
 * a field bound to a categorical scale whose `range` lists the shape names
 * handed out — the three shapes, in order, when absent.
 */
export type ShapeEncoding =
  | ShapeName
  | `jexl:${string}`
  | (CategoricalRef & { range?: ShapeName[] })

/**
 * #api
 * A position that may lie on another sequence: the field holding its refName
 * and the field holding its 0-based coordinate, as a paired record states
 * its mate (`{ chrom: 'mate.refName', pos: 'mate.start' }`). Spelt the way
 * GenomeSpy spells a genomic position over two columns.
 */
export interface LocusRef {
  chrom: FieldRef
  pos: FieldRef
}

/**
 * #api
 * A numeric field read through a linear or log scale into a width in CSS px:
 * `range` is the px at each end of the domain (1 to 6 unset), and each end of
 * the domain is pinned by `domainMin` or `domainMax` or follows the loaded
 * regions' extremes where unset, as a colour ramp's does. A feature holding
 * no number takes the range's first px.
 */
export interface SizeRef {
  field: FieldRef
  scale?: 'linear' | 'log'
  domainMin?: number
  domainMax?: number
  range?: [number, number]
}

/**
 * #api
 * How a mark's `size` channel resolves: a number is a constant width in CSS
 * px for every instance, a field name is `{ field }` with the defaults, and
 * the object binds the field to a scale.
 */
export type SizeEncoding = number | FieldRef | SizeRef

/**
 * #api
 * The declared mapping from a feature's fields to a mark's channels. Every
 * positional channel is a field: `x` defaults to `start` and `x2` to `end`, a
 * mark that plots no value leaves `y` off, and the scale `y` is read through
 * belongs to the display rather than to the encoding. `shape` is read by the
 * `point` mark alone, `row` — an integer field, 0 where missing — by every
 * mark, which stands a feature in the band it names.
 */
export interface MarkEncoding {
  x?: FieldRef
  /** A field, or a {@link LocusRef} where the far end may lie on another sequence. */
  x2?: FieldRef | LocusRef
  y?: FieldRef
  /**
   * The value a `bar` stands on in place of the display's origin: a stack's
   * lower bound, a range's low end. Read by a bar alone.
   */
  y2?: FieldRef
  row?: FieldRef
  color?: ColorEncoding
  shape?: ShapeEncoding
  /** The field a `text` mark prints, read by that mark alone. */
  text?: FieldRef
  /** The width a `link` mark strokes at, read by that mark alone. */
  size?: SizeEncoding
}

/**
 * #api
 * The lanes a caller asks the encoder to fill, beyond `x` and `x2`, which
 * every payload carries, and `featureIndex`, which one carries where a
 * feature was skipped: a mark's channels, and `index` for the Flatbush a
 * hover reads. A lane not asked for is neither
 * allocated nor transferred, and a caller that never hovers declines the
 * index, which is most of the encoder's cost after the walk.
 */
export type LaneName =
  | 'y'
  | 'y2'
  | 'color'
  | 'colorValue'
  | 'glyph'
  | 'row'
  | 'text'
  | 'size'
  | 'x2Ref'
  | 'index'

/**
 * #api
 * The scale a colour channel was resolved through, as the legend reads it —
 * the same table the colours in the payload came from, so the key cannot
 * disagree with the painting.
 */
export type ColorScaleTable =
  | {
      kind: 'categorical'
      field: string
      domain: string[]
      /** The declared range, the other half of what assigns a key its colour. */
      range?: string[]
      /**
       * Whether every non-empty key met here parsed as a finite number: a
       * numeric field the declaration landed on a categorical scale, which
       * the key can then say rather than the encoder typing the field from
       * the data.
       */
      numericKeys?: boolean
      /** Each key met, in the field's order, `''` for no value. */
      entries: { value: string; color: number }[]
    }
  | {
      kind: 'threshold'
      field: string
      /** The cut points, ascending, as numbers. */
      domain: number[]
      /**
       * The declared interval colours, one more than the cuts; the default
       * palette fills what the declaration leaves.
       */
      range?: string[]
      /**
       * Whether a feature with no value painted here, in the no-value grey:
       * the key's `(no value)` row, as the feature display's threshold gives
       * it (ADR-156).
       */
      missing?: boolean
      /**
       * Whether text that is no number painted here, in the misconfiguration
       * grey: the key's `(not a number)` row.
       */
      notNumber?: boolean
    }
  | {
      kind: 'ramp'
      field: string
      scale: 'linear' | 'log'
      /** What the ramp spans here: each declared end, else `extent`'s. */
      domain: [number, number]
      /**
       * Whether each end was declared, and so already agrees across regions;
       * an open end is what a display widens to the union of theirs.
       */
      pinned: [boolean, boolean]
      /**
       * The declared {@link ColorEncoding} `domainMid`: where the middle stop
       * of the straight `lut` sits, which every reader places through
       * render-core's `rampMidNorm` and `rampMidT`.
       */
      domainMid?: number
      /**
       * The declared stops — `range`'s colours or the `scheme` — and
       * `reverse`, which with both ends pinned make up the whole declaration,
       * so marks declaring one ramp alike share a key on it.
       */
      range?: string[]
      scheme?: ColorSchemeName
      reverse?: boolean
      /**
       * This region's own extremes of the field, what a display unions;
       * `[Infinity, -Infinity]` where it holds no number, so a union passes
       * over it.
       */
      extent: [number, number]
      /**
       * The declared `domainQuantile` `extent` follows, below 1 only, so a
       * display re-measuring a subset of the instances clips it alike.
       */
      quantile?: number
      lut: Uint8Array
      /**
       * Whether a feature with no value painted here, in the no-value grey:
       * the key's `(no value)` row, as a threshold's.
       */
      missing?: boolean
      /** Whether text that is no number painted here, in the misconfiguration grey. */
      notNumber?: boolean
    }

/**
 * #api
 * The scale a shape channel was resolved through: which shape each value of
 * the field took.
 */
export interface ShapeScaleTable {
  kind: 'shape'
  field: string
  domain: string[]
  range?: ShapeName[]
  entries: { value: string; shape: ShapeName }[]
}

/**
 * #api
 * The scale a size channel is read through: the `size` lane holds the raw
 * values and the shape maps them to px through this, so a display unions
 * `extent` over its loaded regions into the open ends of `domain` and every
 * region strokes the same value at the same width.
 */
export interface SizeScaleTable {
  field: string
  scale: 'linear' | 'log'
  domain: [number, number]
  pinned: [boolean, boolean]
  range: [number, number]
  extent: [number, number]
}

/**
 * #api
 * The table behind a channel a key is drawn from: a colour's, whose `kind`
 * names the scale it resolved through, or a shape's. A `size` channel's
 * ({@link SizeScaleTable}) draws no key and stands outside.
 */
export type ScaleTable = ColorScaleTable | ShapeScaleTable

/**
 * #api
 * One encoding's channels over one region's features, dense and
 * index-aligned: instance `i` of every array is the same feature, and
 * `featureIndex[i]` says which one of the input list it was, or it is absent
 * where instance `i` is feature `i` ({@link featureIndexAt}). A lane is
 * present when the caller asked for it ({@link LaneName}); {@link Encoded}
 * is this type with a known lane set required.
 */
export interface EncodedChannels {
  count: number
  /**
   * Features the walk left out: one whose `x`, `x2` or `y` read as missing
   * or not a number. A mistyped field skips every feature, so a display
   * reads this beside `count` to say so.
   */
  skipped: number
  /**
   * Of `skipped`, the features whose `x` or `x2` read no number, such as
   * the edges a `bin` writes for a feature lacking its field. Absent where
   * the layer placed nothing by a field, as the density sidecar's does.
   */
  skippedPosition?: number
  x: Uint32Array
  x2: Uint32Array
  featureIndex?: Uint32Array
  y?: Float32Array
  /** Each feature's `y2`, for a bar standing on a value rather than the origin. */
  y2?: Float32Array
  /**
   * Each instance's packed ABGR, or one number every instance paints where
   * the colour is a constant; {@link colorAt} reads either.
   */
  color?: Uint32Array | number
  /**
   * The raw values of a quantitative colour channel — a ramp's or a
   * threshold's — for a caller that named the `colorValue` lane: the scale
   * then resolves on the main thread and in the shader, a ramp against a
   * domain unioned over the loaded regions (`scale.extent` is this region's
   * contribution) and a threshold against its cuts as uniforms. Where the
   * colour reads the field `y` plots, this IS the `y` array, not a copy.
   */
  colorValue?: Float32Array
  /** The point painter's code for each feature's `shape`. */
  glyph?: Uint8Array
  row?: Uint32Array
  /**
   * Each feature's `text` channel as text, `''` where the field holds
   * nothing; a list joins its members with commas. Strings, so the lane is
   * cloned across the wire where the typed lanes are transferred.
   */
  text?: string[]
  /** Each feature's raw `size` value, NaN where it holds no number. */
  size?: Float32Array
  /**
   * Which sequence each feature's `x2` lies on, as an index into
   * `x2RefNames`: the far end's own where `x2` is a {@link LocusRef}, else
   * the feature's, in the adapter's naming either way.
   */
  x2Ref?: Uint32Array
  x2RefNames?: string[]
  /** The finite `y` extremes, `Infinity`/`-Infinity` when nothing plotted. */
  yMin: number
  yMax: number
  /** A Flatbush over (x, y, x2, y), when `index` was asked for and `count` is not 0. */
  flatbushData?: ArrayBuffer
  /** The colour channel's table, when `color` is a scale. */
  scale?: ColorScaleTable
  /** The shape channel's table, when `shape` is a scale. */
  shapeScale?: ShapeScaleTable
  /** The size channel's table, when the `size` lane was filled. */
  sizeScale?: SizeScaleTable
}

/**
 * #api
 * {@link EncodedChannels} with the lanes in `L` present — what
 * `encodeFeatures` answers a caller that named them.
 */
export type Encoded<L extends LaneName> = EncodedChannels &
  Required<Pick<EncodedChannels, Exclude<L, 'index'>>>

/**
 * #api
 * One layer of a `CoreGetEncodedLayers` request: the encoding to evaluate and
 * the lanes the display's mark reads.
 */
export interface LayerRequest {
  encoding: MarkEncoding
  lanes: LaneName[]
  /** This layer's own steps, run after the request's shared ones. */
  transform?: TransformStep[]
}

/**
 * #api
 * What `CoreGetEncodedLayers` answers for one region: `layers[i]` is the
 * request's `layers[i]` over the region's features, so a display's mark
 * list indexes straight into it.
 */
export interface EncodedLayersResult {
  layers: EncodedChannels[]
  /** The sections a facet stacked every layer's rows into. */
  facet?: FacetSection[]
  bytes?: number
  zoomRange?: ZoomRange
  /** What the adapter said about this answer that the features cannot show. */
  notices?: string[]
}

/**
 * #api
 * Keep the features a `jexl:` expression over `feature` admits.
 */
export interface FilterStep {
  type: 'filter'
  expr: string
}

/**
 * #api
 * Write a `jexl:` expression's value over `feature` into the field `as` of
 * every feature.
 */
export interface FormulaStep {
  type: 'formula'
  expr: string
  as: string
}

/**
 * #api
 * Place every feature in a genome-aligned bin of `step` bp, writing the bin's
 * edges over the fields `as` names — `start` and `end` by default, so an
 * `aggregate` grouped by those counts per bin and the bar spans the bin.
 *
 * With `field` (`start` by default) a feature lands in the one bin that field
 * falls in. With `fields`, an interval's start and end, it is cut at the bin
 * edges into one piece per bin it overlaps, each piece writing `overlap`, the
 * bases of the interval inside its bin; a zero-length interval (an insertion)
 * is one piece of overlap 0 in the bin holding its position, and one whose
 * ends are not numbers is none. A piece is its feature with those fields
 * beside it, so its id and hover are the feature's, and an `aggregate` over
 * the pieces weighted by `overlap` is a mean per base.
 */
export type BinStep = {
  type: 'bin'
  step: number
  as?: [string, string]
} & (
  | { field?: FieldRef; fields?: never }
  | { fields: [FieldRef, FieldRef]; field?: never }
)

/**
 * #api
 * One summary over a group: `count` needs no field; `sum`, `mean`, `min` and
 * `max` read one, skipping values that are not numbers. The output field is
 * `as`, else `count` or `<op>_<field>`.
 *
 * `weight` names a field each row counts by: `count` is then the sum of the
 * weights, `sum` the sum of value times weight, and `mean` that over the sum
 * of the weights, a row whose weight is not a number counting for nothing. A
 * weight moves no minimum or maximum, so `min` and `max` read none.
 */
export interface AggregateOp {
  op: 'count' | 'sum' | 'mean' | 'min' | 'max'
  field?: FieldRef
  weight?: FieldRef
  as?: string
}

/**
 * #api
 * One feature per distinct `groupby` value set (one for the whole region
 * with none), spanning its members' extent, carrying the group's fields and
 * every `ops` entry.
 */
export interface AggregateStep {
  type: 'aggregate'
  groupby?: FieldRef[]
  ops: AggregateOp[]
}

/**
 * #api
 * Replace the features with runs of constant depth: how many of them overlap
 * each stretch of the region, in a field `as` (`coverage` by default), with
 * the stretches nothing overlaps left out.
 */
export interface CoverageStep {
  type: 'coverage'
  as?: string
  /**
   * Fields whose distinct values each get their own depth: one run per
   * group per stretch, every group's runs cut at the same stretches, so a
   * `stack` behind it stands them on each other.
   */
  groupby?: FieldRef[]
}

/**
 * #api
 * Stand each group's values on each other: the rows sharing the `groupby`
 * fields, in the order `by`'s values take, each get the running total below
 * them and the total through them in the two fields `as` names (`y0`, `y1`),
 * so a bar reading `y` as the second and `y2` as the first draws a stack.
 */
export interface StackStep {
  type: 'stack'
  /** The field summed, `count` by default. */
  field?: FieldRef
  /** The fields whose shared values make a stack; the last `bin`'s edges by default. */
  groupby?: FieldRef[]
  /** The field whose values order the stack, bottom first, in the field's own order; empty or absent keeps the rows' order. */
  by?: FieldRef
  as?: [string, string]
}

/**
 * #api
 * Fan each feature out into one feature per element of an array-valued field
 * — `subfeatures`, so a gene answers its transcripts and a transcript its
 * exons — or per entry of a record keyed by name, so a VCF record answers one
 * feature per sample and a MAF block one per species, each with its key in
 * `key`. Each answer reads the element's own fields first and the feature it
 * came from for everything else, so an exon still knows its gene's name and
 * strand and a species row its block's reference span. A feature whose field
 * holds no array and no record drops out unless `keepEmpty` says otherwise.
 */
export interface FlattenStep {
  type: 'flatten'
  field?: FieldRef
  /** Written with the element's position in its parent's array. */
  index?: string
  /** Written with the entry's key, where the field is a record. */
  key?: string
  keepEmpty?: boolean
}

/**
 * #api
 * Replace each aligned row with its cells against the reference: one feature
 * per run of columns in one `state` — `match`, `mismatch` or `gap` — on the
 * row's own reference span, a mismatch run carrying its `base` and a match or
 * mismatch run `match` as 1 or 0, and one interbase feature per `insertion`,
 * standing at the reference base it precedes with the inserted bases in
 * `base` and their count in `length`. The row's `field` (`seq`) is the
 * aligned text, and the reference's is the same field on the feature the row
 * was fanned out of, so a `flatten` over a MAF block's `alignments` stands in
 * front. A gap run reaching either end of the row is no cell, and a feature
 * with no parent answers none.
 */
export interface CellsStep {
  type: 'cells'
  field?: FieldRef
}

/**
 * #api
 * Assign every feature the lowest row on which it overlaps nothing already
 * there — greedy first fit in start order, the packing a pileup is — and
 * write it to the field `as` (`row`). `fields` names the interval read
 * (`start`, `end`); `padding` is bp of clearance kept between two features
 * sharing a row. The answer is the input in start order, so a `span`
 * encoding `row` stacks it. Under a facet it packs each section on its own.
 */
export interface PileupStep {
  type: 'pileup'
  as?: string
  fields?: [FieldRef, FieldRef]
  padding?: number
}

/**
 * #api
 * One feature per other end a record states: the `mate` a paired adapter
 * fills in (BEDPE, STAR-Fusion), or each VCF `ALT` naming a locus, a
 * breakend's mate or a symbolic allele's `END` on `CHR2` or its own
 * sequence. Each answer carries `mate` (`refName`, `start`, `end`, 0-based
 * and half-open, and the far end's `mateDirection`), its own end's
 * `mateDirection`, the `alt` it came from and `svType`, the structural
 * class the allele states (`svClassOfAlt`). A record naming no other end drops
 * out, and two records or alleles stating one pair of ends answer once.
 */
export interface MateStep {
  type: 'mate'
}

/**
 * #api
 * One step over the features before a layer is encoded, named by `type` the
 * way GenomeSpy spells a transform; every step runs in order and the next
 * reads what the last answered.
 */
export type TransformStep =
  | FilterStep
  | FormulaStep
  | FlattenStep
  | CellsStep
  | BinStep
  | AggregateStep
  | CoverageStep
  | StackStep
  | PileupStep
  | MateStep

export type CoreGetEncodedLayersArgs = {
  adapterConfig: Record<string, unknown>
  region: { refName: string; start: number; end: number; assemblyName: string }
  layers: LayerRequest[]
  /** The steps over the features, in order, before every layer encodes. */
  transform?: TransformStep[]
  /** Split the features after the shared steps, before each layer's own. */
  facet?: FacetSpec
  /**
   * The zoom the adapter reads at, for one with zoom levels (BigWig); absent
   * is full resolution.
   */
  bpPerPx?: number
  /**
   * What the adapter's `getFeatures` takes beside the region and the zoom, for
   * an adapter whose answer depends on more than those: the GWAS adapter reads
   * its LD join here.
   */
  opts?: object
  byteLimit?: number
}

/**
 * #api
 * A row facet: split the features on `field`'s value, run `transform` and then
 * every layer's own steps over each section alone, and stack the sections,
 * each starting on the row after the one above it ends.
 */
export interface FacetSpec {
  field: FieldRef
  /**
   * Steps over each section's features, before every layer's own: a `pileup`
   * here packs each section on its own rows, which every layer then stands
   * in.
   */
  transform?: TransformStep[]
}

/**
 * #api
 * One faceted section as the worker stacked it: its key, the row it starts on
 * and how many rows it holds.
 */
export interface FacetSection {
  key: string
  firstRow: number
  rowCount: number
}
