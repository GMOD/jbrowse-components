import type { Feature } from '@jbrowse/core/util'

export function stringifyFASTA({ features }: { features: Feature[] }) {
  return features
    .map(feature => {
      const refName = feature.get('refName')
      const start = feature.get('start')
      const end = feature.get('end')
      const seq = feature.get('seq') || ''
      const header = `>${refName}:${start + 1}-${end}`
      const wrappedSeq = seq.match(/.{1,80}/g)?.join('\n') || ''
      return `${header}\n${wrappedSeq}`
    })
    .join('\n')
}
