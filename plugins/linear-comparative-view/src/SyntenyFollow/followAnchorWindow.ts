import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

export interface FollowWindow {
  refName: string
  start: number
  end: number
}

// A window read off a row's blocks, with the screen px it covers
export interface AnchorWindow extends FollowWindow {
  widthPx: number
}

const MIN_VISIBLE_PX = 1

// Relative to the widest window rather than the panel, since a two-contig
// assembly is legitimately lopsided: volvox is 89% ctgA.
const MIN_SHARE_OF_WIDEST = 0.05

const MAX_WINDOWS = 64

function measure(blocks: ContentBlock[]) {
  const byRefName = new Map<string, AnchorWindow>()
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
  return [...byRefName.values()]
}

/**
 * The windows a follow reads off the anchor panel: its visible span on each
 * refName, widest by screen px first. A sliver beside a full panel is dropped,
 * since the count of windows decides rung 3 and a 2px tail of a contig being
 * scrolled off would otherwise spread the row across wherever that tail maps.
 */
export function followAnchorWindows(blocks: ContentBlock[]): AnchorWindow[] {
  const sorted = measure(blocks)
    .filter(w => w.widthPx >= MIN_VISIBLE_PX)
    .sort((a, b) => b.widthPx - a.widthPx)
  const widest = sorted[0]
  return widest
    ? sorted
        .filter(w => w.widthPx >= widest.widthPx * MIN_SHARE_OF_WIDEST)
        .slice(0, MAX_WINDOWS)
    : []
}

/**
 * The windows the level beyond this one reads off a row this pass has just
 * placed: the spans it was placed on, unioned per refName, rather than what it
 * shows, which includes the filler between two mapped contigs. No share floor:
 * a small span is a small alignment.
 */
export function followPlacedWindows(spans: FollowWindow[]): FollowWindow[] {
  const byRefName = new Map<string, FollowWindow>()
  for (const { refName, start, end } of spans) {
    const prev = byRefName.get(refName)
    if (prev) {
      prev.start = Math.min(prev.start, start)
      prev.end = Math.max(prev.end, end)
    } else {
      byRefName.set(refName, { refName, start, end })
    }
  }
  return [...byRefName.values()]
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, MAX_WINDOWS)
}

export function sameWindows(a: FollowWindow[], b: FollowWindow[]) {
  return (
    a.length === b.length &&
    a.every(
      (w, i) =>
        w.refName === b[i]!.refName &&
        w.start === b[i]!.start &&
        w.end === b[i]!.end,
    )
  )
}

// the widest window, which is where the eye reads the view as being
export function followAnchorWindow(blocks: ContentBlock[]) {
  return followAnchorWindows(blocks)[0]
}
