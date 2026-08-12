import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

export interface FollowWindow {
  refName: string
  assemblyName: string
  start: number
  end: number
}

/**
 * The window a follow reads off the anchor panel: its visible span on the ONE
 * refName it is mostly showing.
 *
 * One refName, because a follow maps a window through a single alignment and an
 * alignment lives on one contig pair. A panel straddling a region boundary (two
 * contigs on screen at once, or a whole-genome view) has no single window to
 * map, so the widest contig by SCREEN px wins — the same thing the eye picks as
 * "where the view is". Screen px rather than bp is what makes that true across a
 * region set whose contigs differ in size by orders of magnitude.
 *
 * The span is the union of that refName's blocks rather than the widest single
 * block, so a contig split across a padding block still yields the whole visible
 * stretch — matching `visibleSpanOnRefName`, which the click-driven move uses.
 *
 * `undefined` when the panel is showing nothing, which is a panel mid-init.
 */
export function followAnchorWindow(
  blocks: ContentBlock[],
): FollowWindow | undefined {
  const byRefName = new Map<
    string,
    { block: ContentBlock; widthPx: number; start: number; end: number }
  >()
  for (const b of blocks) {
    const prev = byRefName.get(b.refName)
    if (prev) {
      prev.widthPx += b.widthPx
      prev.start = Math.min(prev.start, b.start)
      prev.end = Math.max(prev.end, b.end)
    } else {
      byRefName.set(b.refName, {
        block: b,
        widthPx: b.widthPx,
        start: b.start,
        end: b.end,
      })
    }
  }
  let best:
    | { block: ContentBlock; widthPx: number; start: number; end: number }
    | undefined
  for (const entry of byRefName.values()) {
    if (!best || entry.widthPx > best.widthPx) {
      best = entry
    }
  }
  return best
    ? {
        refName: best.block.refName,
        assemblyName: best.block.assemblyName,
        start: best.start,
        end: best.end,
      }
    : undefined
}
