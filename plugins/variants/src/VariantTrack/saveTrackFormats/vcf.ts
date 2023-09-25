import { Feature } from '@jbrowse/core/util'

function generateINFO(feature: Feature) {
  return Object.entries(feature.get('INFO'))
    .map(([key, value]) => `${key}=${value}`)
    .join(';')
}
export function stringifyVCF({ features }: { features: Feature[] }) {
  const fields = ['refName', 'start', 'name', 'REF', 'ALT', 'QUAL', 'FILTER']
  return features
    .map(feature => {
      return `${fields
        .map(field => feature.get(field) || '.')
        .join('\t')}\t${generateINFO(feature)}`
    })
    .join('\n')
}
