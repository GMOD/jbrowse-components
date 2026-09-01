import type { RegionTooLargeResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { GatedFetchArgs } from '@jbrowse/core/rpc/byteBudget'
import type { LegendCandidate } from '@jbrowse/core/util/legendCandidates'

/**
 * Byte-gated and byte-only on purpose: multi-row paints into fixed lanes, so a
 * high feature count is a download cost, not a per-glyph render cost, and the
 * display composes no density axis (`CanvasFeatureGateMixin` is the base canvas
 * display's alone). There is deliberately no `maxFeatureDensity` here — adding
 * that axis has to fail at this call site rather than silently pass an argument
 * the worker ignores. See agent-docs/reference/REGION_TOO_LARGE.md.
 */
export interface MultiRowGetFeaturesArgs extends GatedFetchArgs {
  adapterConfig: Record<string, unknown>
  // start/end are integer bp (LGV's bufferedVisibleRegions already rounds).
  region: {
    refName: string
    start: number
    end: number
    assemblyName: string
  }
  // feature attribute whose value assigns each feature to a row. Empty is the
  // auto sentinel — the worker picks one off the columns the data turns out to
  // carry, and reports the pick back as `resolvedPartitionField`. See
  // resolvePartitionField.
  partitionField: string
  // feature attribute holding a signed bp length change against the reference,
  // which turns on the indel-glyph pass. Empty string = off (no deltas packed).
  lengthField: string
  // raw `color` config slot (a CSS color or `jexl:...`), evaluated per feature
  // in the worker against the feature. Per-row color (sampleColorMap / palette /
  // dialog) is applied on the main thread at render time, not here.
  colorConfig: string | undefined
}

// One region's painting: absolute genomic positions, pre-resolved ABGR colors,
// and rows referenced indirectly through a deduplicated `partitionValues` list
// so row strings ship once rather than per feature.
//
// This is what the render side and the hit test read, and it is deliberately
// NOT the whole RPC result — the gate telemetry the same message carries is the
// size gate's, and a renderer has no business reading it. Defined here rather
// than beside the renderers because the worker owns the shape; the rendering
// module re-exports this name rather than aliasing a second one.
export interface MultiRowRegionData {
  featureStarts: Uint32Array
  featureEnds: Uint32Array
  featureColors: Uint32Array
  // signed bp length change per feature (the `lengthField` slot): positive is an
  // insertion the reference span understates, negative a deletion. **Length 0
  // when the slot is unset**, which is the render side's gate for the whole
  // indel-glyph pass — so read it as `featureDeltas.length === featureStarts
  // .length`, never as "index i is 0 so this feature has no indel" (0 is also a
  // legitimate reference-length allele).
  featureDeltas: Int32Array
  partitionValues: string[]
  featurePartitionIndex: Uint32Array
  // per-feature display name (feature `name` attribute), for hover tooltips
  featureNames: string[]
  // per-feature adapter id, used to re-fetch the full feature on click (feature
  // details widget) via GetCanvasFeatureDetails
  featureIds: string[]
  // true when the `color` slot was left at its default and the features carried
  // an `itemRgb`, so featureColors came from the data rather than the default.
  // The main thread reads this to suppress the per-row palette, which would
  // otherwise paint over the colors the BED explicitly asked for.
  usedItemRgb: boolean
  // Attribute names the loaded features carry, for the "Partition by..." menu —
  // the one thing this display's rows depend on that a reader could not reach
  // from the UI, so picking the display type from the track menu gave whatever
  // `name` happened to mean (on RepeatMasker, one row per repeat: thousands of
  // hairlines).
  //
  // Sampled rather than unioned over every feature: the columns of a BED are the
  // same on every line, and a union over half a million features would rebuild a
  // Set per region for an answer the first few rows already give.
  partitionCandidates: string[]
  // The distinct (row, name, color) combinations the features carry, in
  // first-seen order and bounded — the shared derived-key shape, with `rowIndex`
  // indexing `partitionValues`. Packed here because deriving it is a walk over
  // every feature: on the main thread `buildColorLegend` re-walked half a million
  // segments per region on every region arrival, row reorder and recolor, usually
  // to hand back nothing.
  legendCandidates: LegendCandidate[]
  // The attribute this region's rows were actually partitioned on — the
  // configured `partitionField`, or what auto picked off `partitionCandidates`
  // when the slot was left empty (resolvePartitionField). The main thread has no
  // second way to know: the pick depends on columns only the worker has seen.
  resolvedPartitionField: string
}

// What the worker actually returns: the painting plus what the fetch measured on
// the way past. The two travel together because the gate folds into this fetch
// (there is no pre-flight call to carry them separately), which is exactly why
// the render side gets the narrower half.
export interface MultiRowGetFeaturesResult extends MultiRowRegionData {
  // index-only byte estimate for the region, absent when the adapter has none.
  // The main-thread gate takes the per-region max of these.
  //
  // No `featureCount` beside it, for the same reason there is no
  // `maxFeatureDensity` in the args: this display has no density axis, so a
  // count would have nowhere to go. The omission is what makes adding that axis
  // a compile error on both sides rather than a silently dead round trip.
  bytes?: number
}

// The region-too-large short-circuit (shared RegionTooLargeResult from the
// feature-render RPC): returned instead of the packed features when the byte
// gate trips, so no feature payload is downloaded/packed for a region the
// banner will replace.
declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiRowGetFeatures: {
      args: MultiRowGetFeaturesArgs
      return: MultiRowGetFeaturesResult | RegionTooLargeResult
      // only the data half owns buffers to transfer, so only it is wrapped —
      // the other arm of the return crosses as itself
      transferables: MultiRowGetFeaturesResult
    }
  }
}
