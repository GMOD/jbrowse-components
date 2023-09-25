import { Feature } from '@jbrowse/core/util'

export function stringifyBED({ features }: { features: Feature[] }) {
  const fields = ['refName', 'start', 'end', 'name', 'score', 'strand']
  return features
    .map(feature => fields.map(field => feature.get(field)).join('\t'))
    .join('\n')
}
