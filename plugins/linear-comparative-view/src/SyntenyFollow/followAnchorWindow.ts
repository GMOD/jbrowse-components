import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

export interface FollowWindow {
  refName: string
  start: number
  end: number
}

// A contig showing less than a pixel is not part of what the reader is looking
// at, and a whole-genome view of a fragmented assembly has thousands of them.
const MIN_VISIBLE_PX = 1

// Enough for any chromosome-scale assembly, and a bound on what a scaffold-level
// one can cost: the widest few dozen contigs are most of the screen, and the
// answer is an INTERVAL spanning them, so a contig dropped here almost always
// falls between two that were kept.
const MAX_WINDOWS = 64

/**
 * The windows a follow reads off the anchor panel: its visible span on each
 * refName it is showing, widest by SCREEN px first.
 *
 * Per refName because an alignment lives on one contig pair, and the union of
 * that refName's blocks so a contig split by a padding block still yields the
 * whole visible stretch.
 */
export function followAnchorWindows(blocks: ContentBlock[]): FollowWindow[] {
  const byRefName = new Map<string, FollowWindow & { widthPx: number }>()
  for (const b of blocks) {
    const prev = byRefName.get(b.refName)
    if (prev) {
      prev.widthPx += b.widthPx
      prev.start = Math.min(prev.start, b.start)
      prev.end = Math.max(prev.end, b.end)
    } else {
      byRefName.set(b.refName, {
        refName: b.refName,
        widthPx: b.widthPx,
        start: b.start,
        end: b.end,
      })
    }
  }
  return (
    [...byRefName.values()]
      .filter(w => w.widthPx >= MIN_VISIBLE_PX)
      .sort((a, b) => b.widthPx - a.widthPx)
      .slice(0, MAX_WINDOWS)
      // rebuilt so `widthPx` does not ride along undeclared
      .map(({ refName, start, end }) => ({ refName, start, end }))
  )
}

/**
 * The one window a single-contig follow reads off the anchor panel: the widest
 * by SCREEN px, which is what the eye picks as "where the view is" and stays
 * true across contigs differing in size by orders of magnitude.
 *
 * The right operand for everything that maps a window through ONE alignment. A
 * pass placing a row from a whole-genome overview wants `followAnchorWindows`
 * instead — this drops every contig but one, which at that zoom is most of the
 * screen.
 */
export function followAnchorWindow(blocks: ContentBlock[]) {
  return followAnchorWindows(blocks)[0]
}
