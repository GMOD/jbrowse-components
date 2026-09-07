import { alpha } from '@jbrowse/core/ui/palette'
import { nameColorCss } from '@jbrowse/synteny-core'

import { MARK_ALPHA } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'

import type { OffscreenMateSide } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { SyntenyColorBy } from '@jbrowse/synteny-core'

// Declared rather than taken off the display model, which would import this
// package's view: the cycle `parentViewDuck.ts` keeps cut
export interface MarkColorSource {
  linearSyntenyDisplays: {
    // the mode this display paints with, 'reference' already resolved
    effectiveColorBy?: SyntenyColorBy
    paintedChromosomeOrder?: readonly string[]
  }[]
}

// a top-strip mark sits on the query row and names a target contig
const NAMED_AXIS = { top: 'target', bottom: 'query' } as const

// Marks are colored by the contig they name only when every display on the
// level keys its ribbons by that same axis, so the mark speaks the language
// the ribbons already speak. Against any other palette the same color would
// be a key the reader cannot read, or worse, one that looks like it matches.
export function offscreenMateMarkColorFor(
  model: MarkColorSource,
  side: OffscreenMateSide,
) {
  const displays = model.linearSyntenyDisplays
  const axis = NAMED_AXIS[side]
  const keyed =
    displays.length > 0 && displays.every(d => d.effectiveColorBy === axis)
  // asked once per mark, and `nameColorCss` scans the assembly's refName list
  const cache = new Map<string, string>()
  const nameOrder = displays[0]?.paintedChromosomeOrder
  return keyed
    ? (refName: string) => {
        const hit = cache.get(refName)
        if (hit === undefined) {
          const color = alpha(nameColorCss(refName, nameOrder), MARK_ALPHA)
          cache.set(refName, color)
          return color
        }
        return hit
      }
    : undefined
}
