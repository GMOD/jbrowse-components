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
 * How a mark's `color` channel resolves. A CSS colour or a `jexl:` expression
 * returning one paints per feature with no scale; the two object forms bind a
 * field to a scale, which is what a legend can describe.
 *
 * A categorical scale with a `domain` hands palette entries to the listed
 * values in that order, then to whatever else it meets in sorted order;
 * without one each value derives its palette entry from itself (an integer
 * takes the slot it names, anything else hashes in), so every region agrees
 * on a value it shares with another at the cost of an occasional collision,
 * and `domain` is the way to spend the palette deliberately. A continuous
 * scale reads the field through `domain` (the region's own extremes when
 * absent) into `ramp`, and there a listed `domain` is what pins the answer
 * across a whole view.
 */
export type ColorEncoding =
  | string
  | {
      field: FieldRef
      scale: 'categorical'
      palette?: string[]
      domain?: (string | number)[]
    }
  | {
      field: FieldRef
      scale: 'linear' | 'log'
      domain?: [number, number]
      ramp?: RampRef
    }

export type GlyphName = 'disc' | 'triangle' | 'diamond'

/**
 * #api
 * A {@link GlyphName}, or a `jexl:` expression over `feature` returning one.
 */
export type GlyphEncoding = GlyphName | `jexl:${string}`

/**
 * #api
 * The declared mapping from a feature's fields to a mark's channels. `x`
 * defaults to `start` and `x2` to `end`; a mark that plots no value leaves `y`
 * off. `glyph` is a glyph name or a `jexl:` expression returning one, read by
 * the `point` shape alone.
 */
export interface MarkEncoding {
  x?: FieldRef
  x2?: FieldRef
  y?: FieldRef
  color?: ColorEncoding
  glyph?: GlyphEncoding
}

/**
 * #api
 * The scale a colour channel was resolved through, as the legend reads it —
 * the same table the colours in the payload came from, so the key cannot
 * disagree with the painting.
 */
export type ScaleTable =
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
 * One encoding's channels over one region's features, dense and
 * index-aligned: instance `i` of every array is the same feature, and
 * `featureIndex[i]` says which one of the input list it was.
 */
export interface EncodedChannels {
  count: number
  x: Uint32Array
  x2: Uint32Array
  y: Float32Array
  color: Uint32Array
  glyph: Uint8Array
  featureIndex: Uint32Array
  /** The finite `y` extremes, `Infinity`/`-Infinity` when nothing plotted. */
  yMin: number
  yMax: number
  /** A Flatbush over (x, y, x2, y), or undefined when `count` is 0. */
  flatbushData: ArrayBuffer | undefined
  scale: ScaleTable | undefined
}

/**
 * #api
 * What `CoreEncodeFeatures` answers for one region: `layers[i]` is the
 * request's `encodings[i]` over the region's features, so a display's mark
 * list indexes straight into it.
 */
export interface EncodedFeaturesResult {
  layers: EncodedChannels[]
  bytes?: number
}

export type CoreEncodeFeaturesArgs = {
  adapterConfig: Record<string, unknown>
  region: { refName: string; start: number; end: number; assemblyName: string }
  encodings: MarkEncoding[]
  /** `jexl:`-prefixed feature filters, every one of which must pass. */
  filters?: string[]
  byteLimit?: number
  sequenceAdapter?: Record<string, unknown>
}
