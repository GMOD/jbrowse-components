import { alpha } from '@jbrowse/core/ui/palette'
import { nameColorCss } from '@jbrowse/synteny-core'

import { MARK_ALPHA } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'

import type { OffscreenMateSide } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { RefNamePosition } from '@jbrowse/synteny-core'

export interface MarkColorDisplay {
  // the field this display paints by, 'reference' already resolved
  paintedField?: string
  paintedRefNamePosition?: RefNamePosition
}

// a top-strip mark sits on the query row and names a target contig
const NAMED_AXIS = { top: 'target', bottom: 'query' } as const

// Marks are colored by the contig they name only when every display on the
// level keys its ribbons by that same axis, so the mark speaks the language
// the ribbons already speak. Against any other palette the same color would
// be a key the reader cannot read, or worse, one that looks like it matches.
export function offscreenMateMarkColorFor(
  displays: MarkColorDisplay[],
  side: OffscreenMateSide,
) {
  const axis = NAMED_AXIS[side]
  const keyed =
    displays.length > 0 && displays.every(d => d.paintedField === axis)
  // asked once per mark
  const cache = new Map<string, string>()
  const namePosition = displays[0]?.paintedRefNamePosition
  return keyed
    ? (refName: string) => {
        const hit = cache.get(refName)
        if (hit === undefined) {
          const color = alpha(nameColorCss(refName, namePosition), MARK_ALPHA)
          cache.set(refName, color)
          return color
        }
        return hit
      }
    : undefined
}
