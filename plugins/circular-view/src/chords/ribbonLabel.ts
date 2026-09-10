import { assembleLocString } from '@jbrowse/core/util'
import { getMate } from '@jbrowse/synteny-core'

import type { Feature } from '@jbrowse/core/util'

/**
 * What a ribbon is, in one line: the two loci it joins and which way round
 * they read. Rendered as the path's `<title>`, the same annotation a chord
 * carries, so pointing at one answers "which alignment is this" without
 * opening the details panel — and it travels into the SVG export.
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
