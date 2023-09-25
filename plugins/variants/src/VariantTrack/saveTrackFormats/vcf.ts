import { Feature } from '@jbrowse/core/util'

export function stringifyVCF({ features }: { features: Feature[] }) {
  return features
    .map(feature => {
      return `hello ${feature.get('name')}`
    })
    .join('\n')
}
