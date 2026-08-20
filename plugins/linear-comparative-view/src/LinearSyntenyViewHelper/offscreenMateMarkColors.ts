import { alpha } from '@jbrowse/core/ui/palette'
import { nameColorCss } from '@jbrowse/synteny-core'

import { MARK_ALPHA } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'

import type { OffscreenMateSide } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { SyntenyColorBy } from '@jbrowse/synteny-core'

// What a lane needs to know about the ribbons drawn beside it. Declared rather
// than taken off the model, for the reason `ComparativeTrackModel` documents:
// a level's display array types out as `any`, which switches off checking on
// everything read from it.
export interface MarkColorSource {
  linearSyntenyDisplays: {
    // the mode this display actually paints with, 'reference' already resolved
    // to the axis it means for this level
    effectiveColorBy?: SyntenyColorBy
    // that mode's chromosome order, which is the facing row's assembly for
    // 'target' and this row's for 'query'
    paintedChromosomeOrder?: readonly string[]
  }[]
}

// A mark hangs off the axis it HAS and names a contig on the axis it does not:
// a top-strip mark sits on the query row and names a target contig, and the
// bottom strip is the mirror.
const NAMED_AXIS = { top: 'target', bottom: 'query' } as const

/**
 * The color a lane paints its marks, or undefined to leave them the band's grey.
 *
 * COLORED ONLY WHEN THE RIBBONS ARE KEYED THE SAME WAY, which is the whole
 * point rather than a caution. A mark says "this alignment goes to chr7, which
 * you are not showing"; painting it chr7's color says it in the same language
 * the ribbons are already speaking, so a reader watching a followed row move can
 * see that ribbons did not vanish, they became marks. Against a level painting
 * by identity or strand the same palette would be a key the reader has no way to
 * read — a green mark next to a green ribbon, meaning nothing in common — and
 * against a level painting by the axis the mark SITS on rather than the one it
 * names, it is the same palette keyed to the other genome, which is worse than
 * grey because it looks like it matches.
 *
 * All displays on the level or none: the strip is one object across them, and a
 * band whose marks were colored for one track and grey for its neighbour reads
 * as two kinds of mark.
 */
export function offscreenMateMarkColorFor(
  model: MarkColorSource,
  side: OffscreenMateSide,
) {
  const displays = model.linearSyntenyDisplays
  const axis = NAMED_AXIS[side]
  const keyed =
    displays.length > 0 && displays.every(d => d.effectiveColorBy === axis)
  // Memoized because the draw asks once per MARK and there are thousands of
  // them, while `nameColorCss` scans the assembly's refName list — which on a
  // scaffold-heavy assembly is the same list, thousands long, every time.
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
