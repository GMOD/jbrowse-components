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
 * A panel straddling a region boundary (two contigs at once, or a whole-genome
 * view) has no single window to map, so the widest contig by SCREEN px wins —
 * the same thing the eye picks as "where the view is", and true across a region
 * set whose contigs differ in size by orders of magnitude in a way bp is not.
 *
 * The span is the union of that refName's blocks rather than the widest single
 * one, so a contig split across a padding block still yields the whole visible
 * stretch — matching `visibleSpanOnRefName`, which the click-driven move uses.
 *
 * `undefined` when the panel is showing nothing, which is a panel mid-init.
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
  // rebuilt rather than returned as-is, so `widthPx` — the accumulator that
  // picked the winner — does not ride along undeclared
  return best
    ? {
        refName: best.refName,
        start: best.start,
        end: best.end,
      }
    : undefined
}
