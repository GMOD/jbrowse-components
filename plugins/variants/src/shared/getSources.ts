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

    if (renderingMode === 'phased') {
      if (row.HP !== undefined) {
        // already a haplotype entry (from haplotype clustering)
        return [{ ...merged, sampleName }]
      }
      // expand sample to haplotypes
      const ploidy = sampleInfo?.[row.name]?.maxPloidy
      if (ploidy) {
        return makeHaplotypeSources(merged, ploidy)
      }
      return []
    }
    // non-phased mode
    return [{ ...merged, sampleName }]
  })
}
