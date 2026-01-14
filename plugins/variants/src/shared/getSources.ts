import type { SampleInfo, Source } from './types.ts'

function makeHaplotypeSources(source: Source, ploidy: number): Source[] {
  const results: Source[] = []
  for (let i = 0; i < ploidy; i++) {
    const name = `${source.name} HP${i}`
    results.push({ ...source, name, baseName: source.name, HP: i })
  }
  return results
}

export function expandSourcesToHaplotypes({
  sources,
  sampleInfo,
}: {
  sources: Source[]
  sampleInfo: Record<string, SampleInfo>
}) {
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
}) {
  const sourceMap = Object.fromEntries(sources.map(s => [s.name, s]))

  return layout.flatMap(row => {
    const sampleName = row.baseName ?? row.name
    const baseSource = sourceMap[sampleName]

    if (!baseSource) {
      return []
    }

    const merged = { ...baseSource, ...row }

    if (renderingMode === 'phased') {
      if (row.HP !== undefined) {
        // already a haplotype entry (from haplotype clustering)
        return [{ ...merged, baseName: sampleName }]
      }
      // expand sample to haplotypes
      const ploidy = sampleInfo?.[row.name]?.maxPloidy
      if (ploidy) {
        return makeHaplotypeSources(merged, ploidy)
      }
      return []
    }
    // non-phased mode
    return [merged]
  })
}
