import type { ProcessedSource, SampleInfo, Source } from './types.ts'

export function makeHaplotypeSources(
  source: Source,
  ploidy: number,
): ProcessedSource[] {
  const results: ProcessedSource[] = []
  const sampleName = source.sampleName ?? source.name
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

export function expandSourcesToHaplotypes({
  sources,
  sampleInfo,
}: {
  sources: Source[]
  sampleInfo: Record<string, SampleInfo>
}): ProcessedSource[] {
  return sources.flatMap(source => {
    const ploidy = sampleInfo[source.name]?.maxPloidy ?? 2
    return makeHaplotypeSources(source, ploidy)
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
    const sampleName = row.sampleName ?? row.name
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
