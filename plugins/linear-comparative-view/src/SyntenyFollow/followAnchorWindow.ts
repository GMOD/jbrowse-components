import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

export interface FollowWindow {
  refName: string
  start: number
  end: number
}

/**
 * The window a follow reads off the anchor panel: its visible span on the ONE
 * refName it is mostly showing, since an alignment lives on one contig pair.
 *
 * The widest by SCREEN px, which is what the eye picks as "where the view is"
 * and stays true across contigs differing in size by orders of magnitude; and
 * the union of that refName's blocks, so a contig split by a padding block
 * still yields the whole visible stretch.
 */
export function followAnchorWindow(
  blocks: ContentBlock[],
): FollowWindow | undefined {
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
  let best: (FollowWindow & { widthPx: number }) | undefined
  for (const entry of byRefName.values()) {
    if (!best || entry.widthPx > best.widthPx) {
      best = entry
    }
  }
  // rebuilt so `widthPx` does not ride along undeclared
  return best
    ? {
        refName: best.refName,
        start: best.start,
        end: best.end,
      }
    : undefined
}
