import type { Feature } from '@jbrowse/core/util'

export function stringifyBedGraph({ features }: { features: Feature[] }) {
  return features
    .map(feature => {
      const chrom = feature.get('refName')
      const start = feature.get('start')
      const end = feature.get('end')
      const score = feature.get('score') ?? 0
      return `${chrom}\t${start}\t${end}\t${score}`
    })
    .join('\n')
}
