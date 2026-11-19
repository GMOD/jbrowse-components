import { assembleLocString } from '@jbrowse/core/util'
import { getMate } from '@jbrowse/synteny-core'

import type { Feature } from '@jbrowse/core/util'

/**
 * What a ribbon is, in one line: the two loci it joins and which way round
 * they read. The hover tooltip and the path's `<title>`.
 */
export function ribbonLabel(feature: Feature) {
  const mate = getMate(feature)
  const here = assembleLocString({
    assemblyName: feature.get('assemblyName') as string | undefined,
    refName: feature.get('refName'),
    start: feature.get('start'),
    end: feature.get('end'),
  })
  const there = mate ? assembleLocString(mate) : undefined
  const arrow = feature.get('strand') === -1 ? '←' : '→'
  const name = feature.get('name')
  return [name, there ? `${here} ${arrow} ${there}` : here]
    .filter(f => !!f)
    .join('  ')
}
