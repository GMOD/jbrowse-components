import type { SampleInfo, Source } from './types.ts'

export function expandSourcesToHaplotypes({
  sources,
  sampleInfo,
}: {
  sources: Source[]
  sampleInfo: Record<string, SampleInfo>
}) {
  const result: Source[] = []
  for (const source of sources) {
    const info = sampleInfo[source.name]
    const ploidy = info?.maxPloidy ?? 2
    for (let i = 0; i < ploidy; i++) {
      result.push({
        ...source,
        name: `${source.name} HP${i}`,
        HP: i,
      })
    }
  }
  return result
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
  const rows: Source[] = []
  const sourceMap = Object.fromEntries(sources.map(s => [s.name, s]))

  // helper to get base sample name (strips " HP<n>" suffix if present)
  const getBaseName = (name: string) => name.replace(/ HP\d+$/, '')

  for (const row of layout) {
    const isHaplotypeEntry = row.HP !== undefined
    const baseName = getBaseName(row.name)
    const baseSource = sourceMap[baseName]

    if (!baseSource) {
      continue
    }

    if (renderingMode === 'phased') {
      if (isHaplotypeEntry) {
        // already a haplotype entry (from haplotype clustering) - use as-is
        rows.push({
          ...baseSource,
          ...row,
          label: row.name,
          id: row.name,
        })
      } else {
        // expand sample to haplotypes
        const info = sampleInfo?.[row.name]
        if (info?.isPhased) {
          const ploidy = info.maxPloidy
          for (let i = 0; i < ploidy; i++) {
            const id = `${row.name} HP${i}`
            rows.push({
              ...baseSource,
              ...row,
              label: id,
              HP: i,
              id: id,
            })
          }
        }
      }
    } else {
      // non-phased mode
      rows.push({
        ...baseSource,
        ...row,
        label: row.name,
        id: row.name,
      })
    }
  }
  return rows
}
