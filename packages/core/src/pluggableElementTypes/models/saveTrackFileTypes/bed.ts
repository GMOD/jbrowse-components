import type { Feature } from '@jbrowse/core/util'

export function stringifyBED({ features }: { features: Feature[] }) {
  if (features.length === 0) {
    return ''
  }
  const fields = ['refName', 'start', 'end', 'name', 'score', 'strand']
  return `${features
    .map(feature =>
      fields
        .map(field => feature.get(field) ?? '.')
        .join('\t')
        .trim(),
    )
    .join('\n')}\n`
}
