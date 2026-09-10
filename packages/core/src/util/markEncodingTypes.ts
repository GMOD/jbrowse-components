// The declared shape of a mark encoding and what evaluating one produces —
// split from markEncoding.ts because that file's runtime half reaches
// render-core's whole HAL/color-ramp graph for encodeFeatures' native scale
// tables, and RpcRegistry.ts needs only these types for CoreEncodeFeatures'
// wire shape. Importing them from markEncoding.ts would carry that graph into
// every leaf that reaches the RPC registry. scripts/moduleClosure.test.ts
// holds the ceiling.

/**
 * #api
 * Where a channel's value comes from: a feature field name, read natively
 * (`feature.get(name)`), or a `jexl:` expression over `feature` — the opt-in
 * escape, three orders of magnitude slower per feature.
 */
export type FieldRef = string

/**
 * #api
 * The ramp a continuous colour scale samples: a named ramp, or evenly spaced
 * CSS colour stops.
 */
export type RampRef = 'viridis' | string[]

/**
 * #api
 * A field bound to a categorical scale: each distinct value takes one entry
 * of the channel's range — a palette entry for `color`, a glyph name for
 * `glyph`. With a `domain`, the listed values take the range in that order
 * and whatever else the region meets follows, sorted; without one each value
 * derives its entry from itself (an integer takes the slot it names, anything
 * else hashes in), so every region agrees on a value it shares with another at
 * the cost of an occasional collision, and `domain` is the way to spend the
 * range deliberately.
 */
export interface CategoricalRef {
  field: FieldRef
  scale: 'categorical'
  domain?: (string | number)[]
}

/**
 * #api
 * How a mark's `color` channel resolves. A CSS colour or a `jexl:` expression
 * returning one paints per feature with no scale; the two object forms bind a
 * field to a scale, which is what a legend can describe. A continuous scale
 * reads the field through `domain` (the region's own extremes when absent)
 * into `ramp`, and there a listed `domain` is what pins the answer across a
 * whole view.
 */
export type ColorEncoding =
  | string
  | (CategoricalRef & { palette?: string[] })
  | {
      field: FieldRef
      scale: 'linear' | 'log'
      domain?: [number, number]
      ramp?: RampRef
    }

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
 * The declared mapping from a feature's fields to a mark's channels. `x`
 * defaults to `start` and `x2` to `end`; a mark that plots no value leaves `y`
 * off. `glyph` is read by the `point` shape alone, `row` — an integer field,
 * 0 where missing — by the `span` shape, which stacks a feature on the band
 * it names.
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
export type LaneName = 'y' | 'color' | 'glyph' | 'row' | 'index'

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
      entries: { label: string; color: number }[]
    }
  | {
      kind: 'ramp'
      field: string
      scale: 'linear' | 'log'
      domain: [number, number]
      lut: Uint8Array
    }

/**
 * #api
 * The scale a glyph channel was resolved through: which glyph each value of
 * the field took.
 */
export interface GlyphScaleTable {
  kind: 'glyph'
  field: string
  entries: { label: string; glyph: GlyphName }[]
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
  x: Uint32Array
  x2: Uint32Array
  featureIndex: Uint32Array
  y?: Float32Array
  color?: Uint32Array
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
  bytes?: number
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
 * One step over the features before a layer is encoded, named by `type` the
 * way GenomeSpy spells a transform; every step runs in order and the next
 * reads what the last answered.
 */
export type TransformStep =
  | FilterStep
  | FormulaStep
  | BinStep
  | AggregateStep
  | CoverageStep

export type CoreEncodeFeaturesArgs = {
  adapterConfig: Record<string, unknown>
  region: { refName: string; start: number; end: number; assemblyName: string }
  layers: LayerRequest[]
  /** The steps over the features, in order, before every layer encodes. */
  transform?: TransformStep[]
  /** Sugar for leading `filter` steps: `jexl:`-prefixed expressions. */
  filters?: string[]
  byteLimit?: number
  sequenceAdapter?: Record<string, unknown>
}
