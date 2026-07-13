import type { ProcessedSource, SampleInfo, Source } from './types.ts'

// A source's bare VCF sample identity: `sampleName` when present (set once a
// source is processed/HP-expanded), else the raw `name`. Single source of truth
// for the fallback so every genotype-map lookup keys by the same string — see
// the "genotype maps cross the RPC boundary keyed by sampleName" note in
// plugins/variants/src/CLAUDE.md.
export function resolveSampleName(source: Source) {
  return source.sampleName ?? source.name
}

export function makeHaplotypeSources(
  source: Source,
  ploidy: number,
): ProcessedSource[] {
  const results: ProcessedSource[] = []
  const sampleName = resolveSampleName(source)
  for (let i = 0; i < ploidy; i++) {
    results.push({
      ...source,
      name: `${sampleName} HP${i}`,
      sampleName,
      HP: i,
    })
  }
  return results
}

// Single source of truth for the "<sampleName> HP<n>" haplotype-row convention.
// Shared by the worker (cell computation), the model `sources` getter (sidebar
// rows / row count), and the cluster dialog — keeping the naming + ploidy rules
// in one place so the three sites can't drift. Sources that already carry an HP
// index (e.g. from haplotype clustering) pass through unchanged; the rest expand
// into maxPloidy rows, keyed by sampleName, defaulting to diploid.
export function expandSourcesToHaplotypes({
  sources,
  sampleInfo,
}: {
  sources: Source[]
  sampleInfo: Record<string, SampleInfo>
}): ProcessedSource[] {
  return sources.flatMap(source => {
    const sampleName = resolveSampleName(source)
    if (source.HP !== undefined) {
      return [{ ...source, sampleName }]
    }
    return makeHaplotypeSources(source, sampleInfo[sampleName]?.maxPloidy ?? 2)
  })
}

export function getSources({
  sources,
  layout = sources,
  renderingMode,
  sampleInfo,
}: {
  sources: Source[]
  layout?: Source[]
  renderingMode: string
  sampleInfo?: Record<string, SampleInfo>
}): ProcessedSource[] {
  const sourceMap = Object.fromEntries(sources.map(s => [s.name, s]))

  return layout.flatMap(row => {
    const sampleName = resolveSampleName(row)
    const baseSource = sourceMap[sampleName]

    if (!baseSource) {
      return []
    }

    const merged = { ...baseSource, ...row }

    // Phased expansion needs sampleInfo to know ploidy. Without it we fall
    // through and return the sample row as-is — matches the `sources` getter
    // in MultiSampleVariantBaseModel, which waits for sampleInfo before
    // expanding. Once sampleInfo is present, missing samples default to
    // diploid to match `expandSourcesToHaplotypes`.
    if (
      renderingMode === 'phased' &&
      row.HP === undefined &&
      sampleInfo !== undefined
    ) {
      return makeHaplotypeSources(
        merged,
        sampleInfo[sampleName]?.maxPloidy ?? 2,
      )
    }
    return [{ ...merged, sampleName }]
  })
}
