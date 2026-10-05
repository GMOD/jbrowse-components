export interface Source {
  baseUri?: string
  name: string
  // Display override for `name` in the sidebar (e.g. a friendly sample label).
  // `name` stays the stable identity used for hit-testing and genotype lookup.
  label?: string
  sampleName?: string
  // the samplesTsv's own colour for the sample
  color?: string
  // the resolved colour the row's label bar draws
  rowColor?: string
  group?: string
  HP?: number
  [key: string]: unknown
}

export type ProcessedSource = Source & { sampleName: string }

// Per-feature info for hover tooltips and the feature widget: one per record
// in a payload's `featureInfo`, in the order its cells index them.
interface VariantFeatureBase {
  featureId: string
  ref: string
  alt: string[]
  name: string
  description: string
  length: number
  // Bases inserted beyond the reference span (getInsertedBp), 0 for anything
  // that isn't an insertion. `length` is the reference span, which is ~1 for an
  // insertion however large, so without this the tooltip could not explain the
  // number the insertion marker paints on the cell.
  insertedBp: number
  // SO term(s) for the variant (e.g. 'breakend', 'deletion', 'inversion').
  // Carried through so a feature clicked from a multi-sample display opens the
  // widget with its SV / breakend navigation panels, which key off `type`.
  type: string
}

// Genotype strings are interned into the shared `CellDataResult.genotypeDict`;
// `genotypeCodes` is aligned to `CellDataResult.sampleNames` (0 = none, else
// `dict[code - 1]`). Decode via shared/genotypeCodec.ts. This keeps F×S
// sample-name keys off the RPC wire — and, since the codes are what
// `analyzeVariants` builds in its one pass over the genotypes, off the
// worker's heap as well: the cell loops read this same array rather than a
// per-feature `Record<sampleName, genotype>` that had to be built, walked
// three times, and then interned into exactly this.
export interface VariantFeatureInfo extends VariantFeatureBase {
  genotypeCodes: Uint32Array
}
