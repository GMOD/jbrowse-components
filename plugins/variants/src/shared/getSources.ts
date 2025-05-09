import type { SampleInfo, Source } from './types'

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
  const rows = []
  const sourceMap = Object.fromEntries(sources.map(s => [s.name, s]))
  for (const row of layout) {
    // make separate rows for each haplotype in phased mode
    if (renderingMode === 'phased') {
      const info = sampleInfo?.[row.name]
      if (info?.isPhased) {
        const ploidy = info.maxPloidy
        for (let i = 0; i < ploidy; i++) {
          const id = `${row.name} HP${i}`
          rows.push({
            ...sourceMap[row.name],
            ...row,
            label: id,
            HP: i,
            id: id,
          })
        }
      }
    }
    // non-phased mode does not make separate rows
    else {
      rows.push({
        ...sourceMap[row.name],
        ...row,
        label: row.name,
        id: row.name,
      })
    }
  }
  return rows
}
