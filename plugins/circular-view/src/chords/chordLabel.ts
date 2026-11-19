import { assembleLocString } from '@jbrowse/core/util'
import { svMateLocus } from '@jbrowse/sv-core'

import type { Feature } from '@jbrowse/core/util'

function locus(refName: string, pos: number) {
  return assembleLocString({ refName, start: pos, end: pos + 1 })
}

/**
 * What a chord is, in one line: the hover tooltip and the path's `<title>`.
 */
export function chordLabel(feature: Feature) {
  const refName = feature.get('refName')
  const mate = svMateLocus(feature)
  const name = feature.get('name') ?? feature.get('id')
  const where = mate
    ? `${locus(refName, feature.get('start'))} → ${locus(mate.refName, mate.pos)}`
    : assembleLocString({
        refName,
        start: feature.get('start'),
        end: feature.get('end'),
      })
  return [name, where].filter(f => !!f).join('  ')
}
