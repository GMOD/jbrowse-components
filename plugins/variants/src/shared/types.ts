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

// Per-feature info that crosses the RPC boundary for hover tooltips and the
// feature widget. Single-sourced so the regular and matrix displays can't
// drift: the regular display keys these by feature id (`featureGenotypeMap`),
// the matrix carries them positionally (`FeatureData`, which adds `featureId`).
// `genotypes` is keyed by `sampleName` (bare VCF identity), never the
// HP-suffixed render `name` — see plugins/variants/src/CLAUDE.md.
export interface VariantFeatureInfo {
  ref: string
  alt: string[]
  name: string
  description: string
  length: number
  genotypes: Record<string, string>
}
