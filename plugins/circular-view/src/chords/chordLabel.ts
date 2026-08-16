import { assembleLocString } from '@jbrowse/core/util'
import { svMateLocus } from '@jbrowse/sv-core'

import type { Feature } from '@jbrowse/core/util'

function locus(refName: string, pos: number) {
  return assembleLocString({ refName, start: pos, end: pos + 1 })
}

/**
 * What a chord is, in one line.
 *
 * Rendered as the path's `<title>`, so a reader can find out by pointing at it.
 * Until this existed the only way to learn anything about a chord was to click
 * it, which opens a modal asking how to build a whole view — a lot to commit to
 * for "which record is this". A `<title>` child costs nothing per chord, which
 * matters when a whole-genome callset is tens of thousands of them, and it
 * travels into the SVG export as the figure's own annotation.
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
