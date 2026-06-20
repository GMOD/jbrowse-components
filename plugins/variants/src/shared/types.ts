export interface Source {
  baseUri?: string
  name: string
  sampleName?: string
  color?: string
  group?: string
  HP?: number
  [key: string]: unknown
}

export type ProcessedSource = Source & { sampleName: string }

export interface SampleInfo {
  isPhased: boolean
  maxPloidy: number
}

// Per-feature info for hover tooltips and the feature widget. Single-sourced so
// the regular and matrix displays can't drift: the regular display keys these by
// feature id (`featureGenotypeMap`), the matrix carries them positionally
// (`FeatureData`, which adds `featureId`).
interface VariantFeatureBase {
  ref: string
  alt: string[]
  name: string
  description: string
  length: number
}

// Worker-internal shape produced by the cell computations: per-feature
// genotypes keyed by `sampleName` (bare VCF identity, never the HP-suffixed
// render `name` — see plugins/variants/src/CLAUDE.md).
export interface VariantFeatureGenotypes extends VariantFeatureBase {
  genotypes: Record<string, string>
}

// Shipped-to-client shape: genotype strings are interned into the shared
// `CellDataResult.genotypeDict`; `genotypeCodes` is aligned to
// `CellDataResult.sampleNames` (0 = none, else `dict[code - 1]`). Decode via
// shared/genotypeCodec.ts. This keeps F×S sample-name keys off the RPC wire.
export interface VariantFeatureInfo extends VariantFeatureBase {
  genotypeCodes: Uint16Array
}
