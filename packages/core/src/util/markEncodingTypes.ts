// The declared shape of a mark encoding and what evaluating one produces —
// split from markEncoding.ts because that file's runtime half reaches
// render-core's whole HAL/color-ramp graph for encodeFeatures' native scale
// tables, and RpcRegistry.ts needs only these types for CoreEncodeFeatures'
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
 * of the channel's `range` — a colour for `color`, a glyph name for
 * `glyph`. Every value derives its entry from itself (an integer takes the
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

export type GlyphName = 'disc' | 'triangle' | 'diamond'

/**
 * #api
 * A {@link GlyphName}, a `jexl:` expression over `feature` returning one, or
 * a field bound to a categorical scale whose `range` lists the glyph names
 * handed out — the three glyphs, in order, when absent.
 */
export type GlyphEncoding =
  | GlyphName
  | `jexl:${string}`
  | (CategoricalRef & { range?: GlyphName[] })

/**
 * #api
 * The declared mapping from a feature's fields to a mark's channels. Every
 * positional channel is a field: `x` defaults to `start` and `x2` to `end`, a
 * mark that plots no value leaves `y` off, and the scale `y` is read through
 * belongs to the display rather than to the encoding. `glyph` is read by the
 * `point` shape alone, `row` — an integer field, 0 where missing — by every
 * shape, which stands a feature in the band it names.
 */
export interface MarkEncoding {
  x?: FieldRef
  x2?: FieldRef
  y?: FieldRef
  row?: FieldRef
  color?: ColorEncoding
  glyph?: GlyphEncoding
}

/**
 * #api
 * The lanes a caller asks the encoder to fill, beyond `x`, `x2` and
 * `featureIndex`, which every payload carries: a shape's channels, and
 * `index` for the Flatbush a hover reads. A lane not asked for is neither
 * allocated nor transferred, and a caller that never hovers declines the
 * index, which is most of the encoder's cost after the walk.
 */
export type LaneName = 'y' | 'color' | 'colorValue' | 'glyph' | 'row' | 'index'

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
      /** The colour of each interval, in order: one more than the cuts. */
      range: number[]
      /**
       * Each key met, in bin order: an interval's label, then `''` for a
       * feature with no value, painted the no-value grey, and `(not a number)`
       * for text that is no number, painted the misconfiguration grey — the
       * rows the feature display's threshold gives its key (ADR-156), each
       * listed only once painted.
       */
      entries: { value: string; color: number }[]
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
      /** The declared {@link ColorEncoding} `domainMid`, already baked into `lut`. */
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
      lut: Uint8Array
      /**
       * The ramp's RGBA stops, carried beside a `domainMid`: where the middle
       * stop lands in `lut` depends on the domain, so a display that unions an
       * unpinned domain past this region's bakes `lut` again from these.
       */
      stops?: readonly (readonly [number, number, number, number])[]
    }

/**
 * #api
 * The scale a glyph channel was resolved through: which glyph each value of
 * the field took.
 */
export interface GlyphScaleTable {
  kind: 'glyph'
  field: string
  domain: string[]
  range?: GlyphName[]
  entries: { value: string; glyph: GlyphName }[]
}

/**
 * #api
 * Any channel's scale table; the kind names the channel.
 */
export type ScaleTable = ColorScaleTable | GlyphScaleTable

/**
 * #api
 * One encoding's channels over one region's features, dense and
 * index-aligned: instance `i` of every array is the same feature, and
 * `featureIndex[i]` says which one of the input list it was. A lane is
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
  featureIndex: Uint32Array
  y?: Float32Array
  color?: Uint32Array
  /**
   * The raw values of a ramp colour channel, for a caller that named the
   * `colorValue` lane: the scale then resolves on the main thread against a
   * domain unioned over the loaded regions, and `scale.extent` is this
   * region's contribution to it.
   */
  colorValue?: Float32Array
  glyph?: Uint8Array
  row?: Uint32Array
  /** The finite `y` extremes, `Infinity`/`-Infinity` when nothing plotted. */
  yMin: number
  yMax: number
  /** A Flatbush over (x, y, x2, y), when `index` was asked for and `count` is not 0. */
  flatbushData?: ArrayBuffer
  /** The colour channel's table, when `color` is a scale. */
  scale?: ColorScaleTable
  /** The glyph channel's table, when `glyph` is a scale. */
  glyphScale?: GlyphScaleTable
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
 * One layer of a `CoreEncodeFeatures` request: the encoding to evaluate and
 * the lanes the display's shape reads.
 */
export interface LayerRequest {
  encoding: MarkEncoding
  lanes: LaneName[]
  /** This layer's own steps, run after the request's shared ones. */
  transform?: TransformStep[]
}

/**
 * #api
 * What `CoreEncodeFeatures` answers for one region: `layers[i]` is the
 * request's `layers[i]` over the region's features, so a display's mark
 * list indexes straight into it.
 */
export interface EncodedFeaturesResult {
  layers: EncodedChannels[]
  /** The sections a facet stacked every layer's rows into. */
  facet?: FacetSection[]
  bytes?: number
  zoomRange?: ZoomRange
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
 * Snap every feature to the genome-aligned bin of `step` bp its `field`
 * (`start` by default) falls in, writing the bin's edges over the fields
 * `as` names — `start` and `end` by default, so an `aggregate` grouped by
 * those counts per bin and the bar spans the bin.
 */
export interface BinStep {
  type: 'bin'
  step: number
  field?: FieldRef
  as?: [string, string]
}

/**
 * #api
 * One summary over a group: `count` needs no field; `sum`, `mean`, `min` and
 * `max` read one, skipping values that are not numbers. The output field is
 * `as`, else `count` or `<op>_<field>`.
 */
export interface AggregateOp {
  op: 'count' | 'sum' | 'mean' | 'min' | 'max'
  field?: FieldRef
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
}

/**
 * #api
 * Fan each feature out into one feature per element of an array-valued field
 * — `subfeatures`, so a gene answers its transcripts and a transcript its
 * exons. Each answer reads the element's own fields first and the feature it
 * came from for everything else, so an exon still knows its gene's name and
 * strand. A feature whose field holds no array drops out unless `keepEmpty`
 * says otherwise.
 */
export interface FlattenStep {
  type: 'flatten'
  field?: FieldRef
  /** Written with the element's position in its parent's array. */
  index?: string
  keepEmpty?: boolean
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
 * One step over the features before a layer is encoded, named by `type` the
 * way GenomeSpy spells a transform; every step runs in order and the next
 * reads what the last answered.
 */
export type TransformStep =
  | FilterStep
  | FormulaStep
  | FlattenStep
  | BinStep
  | AggregateStep
  | CoverageStep
  | PileupStep

export type CoreEncodeFeaturesArgs = {
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
  byteLimit?: number
  sequenceAdapter?: Record<string, unknown>
}

/**
 * #api
 * A row facet: split the features on `field`'s value, run every layer's own
 * steps over each section alone, and stack the sections, each starting on the
 * row after the one above it ends.
 */
export interface FacetSpec {
  field: FieldRef
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
